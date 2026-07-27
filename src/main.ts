import { config as loadEnv } from "dotenv";
import * as Mail from "supermail";
import { ListEmailsOptions, ListEmailsResponse } from "supermail";
import Matrix, { EventType, MsgType } from "matrix-js-sdk";

loadEnv();

const imapHost = process.env.EMAIL_HOST_IMAP;
const smtpHost = process.env.EMAIL_HOST_SMTP;
const username = process.env.EMAIL_USERNAME;
const password = process.env.EMAIL_PASSWORD;
const imapPort = process.env.EMAIL_PORT_IMAP;
const smtpPort = process.env.EMAIL_PORT_SMTP;
const secureSmtp = process.env.EMAIL_SMTP_SECURE == "true";
const secureImap = process.env.EMAIL_IMAP_SECURE == "true";
const receiveInterval = parseInt(process.env.EMAIL_RECV_INTERVAL_MS ?? "15000");
const emailFilter = process.env.EMAIL_FILTER;
const emailPageSize = 10;

const matrixServerUrl = process.env.MATRIX_SERVER_URL;
const matrixAccessToken = process.env.MATRIX_ACCESS_TOKEN;
const matrixUserId = process.env.MATRIX_USERID;
const matrixReceiveRoomId = process.env.MATRIX_RECEIVE_ROOM_ID!;
const matrixDeviceId = process.env.MATRIX_DEVICE_ID;
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
if (!smtpPort) {
  throw new Error("EMAIL_PORT_SMTP is undefinde");
}
if (!imapHost) {
  throw new Error("EMAIL_HOST_IMAP is undefinde");
}
if (!smtpHost) {
  throw new Error("EMAIL_HOST_SMTP is undefinde");
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

const emailClient = new Mail.SuperMail({
  type: "imap",
  imap: {
    user: username,
    password: password,
    host: imapHost,
    port: parseInt(imapPort),
    tls: secureImap,
  },
  smtp: {
    host: smtpHost,
    port: parseInt(smtpPort),
    secure: secureSmtp,
    auth: {
      user: username,
      pass: password,
    },
  },
});

async function getAllUnreadEmails() {
  try {
    const options: ListEmailsOptions = {
      maxResults: emailPageSize,
      unreadOnly:true
    };
    if (emailFilter) {
      options.query = emailFilter;
    }
    const emailMessages: (ListEmailsResponse)["messages"] = [];
    const emailsResponse = await emailClient.listEmails(options);
    console.log(`Checked inbox.`, { emailsResponse,messages:emailsResponse.messages, options })
    emailMessages.push(...emailsResponse.messages);
    const totalMessages = emailsResponse.totalCount || 0;
    let nextPageToken = emailsResponse.nextPageToken
    if (emailsResponse.nextPageToken) {
      try {
        for (
          let emailsPageIdx = 1;
          emailsPageIdx < totalMessages / emailPageSize;
          emailsPageIdx++
        ) {
          const emailsPageResponse = await emailClient.listEmails({
            ...options,
            pageToken: nextPageToken,
          });
          nextPageToken = emailsPageResponse.nextPageToken;
          emailMessages.push(...emailsPageResponse.messages);
        }
      } catch (error) {
        console.error(error);
      }
    }
    for (const email of emailMessages) {
      try {
        if (email.id) {
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
  return await matrixClient.sendEvent<EventType.RoomMessage>(
    matrixReceiveRoomId,
    null,
    EventType.RoomMessage,
    { body: text, msgtype: MsgType.Text },
    tnxId,
  );
}

async function checkNewEmails(): Promise<void> {
  const newMessages = await getAllUnreadEmails();
  console.log(`Checked inbox. ${newMessages.length} new emails.`)
  for (const emailMessage of newMessages) {
    try {
      await sendMessage(emailMessage.body, emailMessage.id)
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
    await sendMessage(`${new Date().toISOString()} запуск сервера`);
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
