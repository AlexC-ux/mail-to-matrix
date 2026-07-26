import {
  SuperMail,
  type ListEmailsOptions,
  type ListEmailsResponse,
} from "supermail";
import sdk, { EventType, MsgType } from "matrix-js-sdk";

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

const matrixClient = sdk.createClient({
  baseUrl: matrixServerUrl,
  accessToken: matrixAccessToken,
  userId: matrixUserId,
});

if (matrixEnableEndToEndEncryption) {
  matrixClient.initRustCrypto();
}

const emailClient = new SuperMail({
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
      unreadOnly: true,
    };
    if (emailFilter) {
      options.query = emailFilter;
    }
    const emailMessages: ListEmailsResponse["messages"] = [];
    const emailsResponse = await emailClient.listEmails(options);
    emailMessages.push(...emailsResponse.messages);
    const totalMessages = emailsResponse.totalCount || 0;
    if (emailsResponse.nextPageToken) {
      try {
        for (
          let emailsPageIdx = 1;
          emailsPageIdx < totalMessages / emailPageSize;
          emailsPageIdx++
        ) {
          const emailsPageResponse = await emailClient.listEmails({
            ...options,
            pageToken: emailsResponse.nextPageToken,
          });
          emailMessages.push(...emailsPageResponse.messages);
        }
      } catch (error) {
        console.error(error);
      }
    }
    return emailMessages;
  } catch (error) {
    console.error(error);
    return [];
  }
}

async function checkNewEmails() {
  const newMessages = await getAllUnreadEmails();
  for (const emailMessage of newMessages) {
    try {
      await matrixClient.sendEvent<EventType.RoomMessage>(
        matrixReceiveRoomId,
        null,
        EventType.RoomMessage,
        { body: emailMessage.body, msgtype: MsgType.Text },
        emailMessage.id,
      );
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
    // интервал проверки писем
    setTimeout(checkNewEmails, receiveInterval);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
