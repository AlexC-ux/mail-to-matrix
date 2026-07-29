import { config as loadEnv } from "dotenv";
import { EmailClient, ListEmailsOptions, ListEmailsResponse } from "./EmailClient";
import Matrix, { EventType, MsgType } from "matrix-js-sdk";
import { RoomMessageEventContent } from "matrix-js-sdk/lib/types";

loadEnv();

const imapHost = process.env.EMAIL_HOST_IMAP;
const username = process.env.EMAIL_USERNAME;
const password = process.env.EMAIL_PASSWORD;
const imapPort = process.env.EMAIL_PORT_IMAP;
const secureImap = process.env.EMAIL_IMAP_SECURE == "true";
const receiveInterval = parseInt(process.env.EMAIL_RECV_INTERVAL_MS ?? "15000");
console.log({ receiveInterval })
const emailFilter = process.env.EMAIL_FILTER;
const emailPageSize = 10;

const matrixServerUrl = process.env.MATRIX_SERVER_URL;
const matrixAccessToken = process.env.MATRIX_ACCESS_TOKEN;
const matrixUserId = process.env.MATRIX_USERID;
const matrixReceiveRoomId = process.env.MATRIX_RECEIVE_ROOM_ID!;
const matrixDeviceId = process.env.MATRIX_DEVICE_ID;
const matrixMessageAsNotice = process.env.MATRIX_MESSAGE_AS_NOTICE === "true"
const matrixEnableEndToEndEncryption =
  process.env.MATRIX_USE_ENCTYPTION == "true";

if (!username) {
  throw new Error("EMAIL_USERNAME is undefined");
}
if (!password) {
  throw new Error("EMAIL_PASSWORD is undefinde");
}
if (!imapPort) {
  throw new Error("EMAIL_PORT_IMAP is undefinde");
}
if (!imapHost) {
  throw new Error("EMAIL_HOST_IMAP is undefinde");
}

if (!matrixServerUrl) {
  throw new Error("MATRIX_SERVER_URL is undefinde");
}
if (!matrixAccessToken) {
  throw new Error("MATRIX_ACCESS_TOKEN is undefinde");
}
if (!matrixUserId) {
  throw new Error("MATRIX_USERID is undefinde");
}
if (!matrixReceiveRoomId) {
  throw new Error("MATRIX_RECEIVE_ROOM_ID is undefinde");
}
if (matrixEnableEndToEndEncryption && !matrixDeviceId) {
  throw new Error("MATRIX_DEVICE_ID is undefinde");
}

const matrixClient = Matrix.createClient({
  baseUrl: matrixServerUrl,
  accessToken: matrixAccessToken,
  userId: matrixUserId,
  deviceId: matrixDeviceId,
});

if (matrixEnableEndToEndEncryption) {
  matrixClient.initRustCrypto();
}

const emailClient = new EmailClient({
  imap: {
    user: username,
    password: password,
    host: imapHost,
    port: parseInt(imapPort),
    tls: secureImap,
  }
});

async function getAllUnreadEmails() {
  try {
    const options: ListEmailsOptions = {
      maxResults: emailPageSize,
      unreadOnly: true
    };
    if (emailFilter) {
      options.query = emailFilter;
    }
    const emailMessages: (ListEmailsResponse)["messages"] = [];
    const emailsResponse = await emailClient.listEmails(options);
    console.log(`Checked inbox.`, {
      totalCount: emailsResponse.totalCount,
      nextPageToken: emailsResponse.nextPageToken,
      messagesCount: emailsResponse.messages.length,
      messages: emailsResponse.messages.map(m => ({ id: m.id, subject: m.subject, body: m.body })),
      options
    })
    emailMessages.push(...emailsResponse.messages);
    let nextPageToken = emailsResponse.nextPageToken;
    while (nextPageToken) {
      try {
        const emailsPageResponse = await emailClient.listEmails({
          ...options,
          pageToken: nextPageToken,
        });
        nextPageToken = emailsPageResponse.nextPageToken;
        emailMessages.push(...emailsPageResponse.messages);
      } catch (error) {
        console.error("Error fetching next page:", error);
        break;
      }
    }
    for (const email of emailMessages) {
      try {
        if (email.id) {
          console.log(`Marking as read emailid=${email.id}`)
          await emailClient.markAsRead(email.id)
        }
      } catch (error) {
        console.error(error)
      }
    }
    return emailMessages;
  } catch (error) {
    console.error(error);
    return [];
  }
}

async function sendMessage(text: string, tnxId?: string) {
  const content: RoomMessageEventContent = {
    formatted_body: text,
    format: "org.matrix.custom.html",
    body: text,
    msgtype: matrixMessageAsNotice ? MsgType.Notice : MsgType.Text
  };
  return await matrixClient.sendEvent<EventType.RoomMessage>(
    matrixReceiveRoomId,
    null,
    EventType.RoomMessage,
    content,
    tnxId,
  );
}

async function checkNewEmails(): Promise<void> {
  console.log(`Checking inbox...`)
  const newMessages = await getAllUnreadEmails();
  console.log(`Checked inbox. ${newMessages.length} new emails.`)
  for (const emailMessage of newMessages) {
    try {
      await sendMessage([`<hr>🕐<i> ${(emailMessage.date)}</i><br>📨<i> ${emailMessage.from.replace(/[<>]/g, '')}</i><br><b>${(emailMessage.subject || '').replace(/\\n/g, '<br>')}</b>`,
        '<br>',
      `${emailMessage.body.replace(/$/gm, '<br/>')}`].join('\n'), emailMessage.id)
    } catch (error) {
      console.error(emailMessage);
      console.error(error);
    }
  }
}

async function main() {
  try {
    // проверка подключения
    await emailClient.listEmails({ maxResults: 1 });
    console.log('Email checked and working')
    await sendMessage(`${new Date().toUTCString()} запуск сервера mail-to-matrix`);
    console.log('Matrix checked and working')
    // интервал проверки писем
    setInterval(checkNewEmails, receiveInterval);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

console.log('Launching...')
main();
