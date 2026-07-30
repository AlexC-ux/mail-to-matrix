import Imap from "imap";
import { simpleParser } from "mailparser";
import { Box } from "imap";

// Type definitions for mailparser
interface MailAddress {
  text?: string,
  html?: string,
  value?: string[]
}

interface ParsedMail {
  subject?: string;
  from?: MailAddress | MailAddress[];
  to?: MailAddress | MailAddress[];
  text?: string;
  html?: string;
  date?: Date | string;
}

// Type definitions for imap message/events
interface MailMessage {
  on(event: "message", callback: (msg: MailMessage, seqno: number) => void): void;
  on(event: "attributes", callback: (attrs: FetchAttributes) => void): void;
  on(event: "body", callback: (stream: NodeJS.ReadStream) => void): void;
  on(event: "end", callback: () => void): void;
  on(event: "error", callback: (err: Error) => void): void;
  on(event: string, callback: (...args: unknown[]) => void): void;
}

interface FetchAttributes {
  uid?: number;
  seqno?: number;
}

export interface EmailMessage {
  id?: string;
  subject: string;
  from: string;
  to: string;
  body: string;
  date: string;
  unread: boolean;
}

export interface ListEmailsOptions {
  unreadOnly?: boolean;
  query?: string;
}

export interface ListEmailsResponse {
  messages: EmailMessage[];
  totalCount?: number;
}

export interface IMAPConfig {
  user: string;
  password: string;
  host: string;
  port: number;
  tls: boolean;
}

export class EmailClient {
  private imap: Imap | null = null;
  private config: IMAPConfig;

  constructor(config: { imap: IMAPConfig }) {
    this.config = config.imap;
  }

  private createImapConnection(): Imap {
    return new Imap({
      user: this.config.user,
      password: this.config.password,
      host: this.config.host,
      port: this.config.port,
      tls: this.config.tls,
      tlsOptions: { rejectUnauthorized: false },
    });
  }

  private connectImap(): Promise<Imap> {
    return new Promise((resolve, reject) => {
      const imap = this.createImapConnection();
      imap.on("error", (err: Error) => reject(err));
      imap.on("ready", () => resolve(imap));
      imap.connect();
    });
  }

  private async withImapConnection<T>(action: (imap: Imap) => Promise<T>): Promise<T> {
    const imap = await this.connectImap();
    try {
      return await action(imap);
    } finally {
      imap.end();
    }
  }

  private fetchSingleMessage(imap: Imap, uid: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const uidFetch = imap.fetch(uid, {
        bodies: [""],
        struct: true,
        envelope: true,
      });

      let buffer = "";

      uidFetch.on("message", (msg: MailMessage) => {
        msg.on("body", (stream: NodeJS.ReadStream) => {
          stream.on("data", (chunk: Buffer) => {
            buffer += chunk.toString("utf8");
          });
        });
      });

      uidFetch.on("error", (err: Error) => reject(err));
      uidFetch.on("end", () => resolve(buffer));
    });
  }

  async listEmails(options: ListEmailsOptions = {}): Promise<ListEmailsResponse> {
    const unreadOnly = options.unreadOnly !== false;
    const query = options.query;

    return await this.withImapConnection(async (imap) => {
      return new Promise((resolve, reject) => {
        imap.openBox("INBOX", false, (error: Error | null, _box: Box) => {
          if (error || !_box) {
            reject(error || new Error("Failed to open INBOX"));
            return;
          }

          try {
            const searchCriteria: Array<string|string[]> = [];
            if (unreadOnly) {
              searchCriteria.push("UNSEEN");
            }
            if (query) {
              const queries = query.split(',');
              for (let index = 0; index < queries.length; index++) {
                const [expr,value] = queries[index].split(':');
                switch (expr.toLowerCase()) {
                  case "from":
                    searchCriteria.push(["FROM", `${value}`]);
                    break;
                  case "date":
                    searchCriteria.push(["SINCE", `${value}`]);
                    break;
                  case "text":
                    searchCriteria.push(["TEXT", `${value}`]);
                    break;
                  case "subject":
                    searchCriteria.push(["SUBJECT", `${value}`]);
                    break;
                  default:
                    searchCriteria.push(["TEXT", `${value}`]);
                    break;
                }
              }
            }

            const criteria = searchCriteria.length > 0 ? searchCriteria : ["ALL"];
            console.log(`Searching email`,criteria)
            imap.search(criteria, (_err: Error | null, results: number[]) => {
              const sortedUids = results.sort((a: number, b: number) => b - a);
              const totalCount = sortedUids.length;

              if (sortedUids.length === 0) {
                resolve({ messages: [], totalCount });
                return;
              }

              (async () => {
                const messages: EmailMessage[] = [];
                for (const uid of sortedUids) {
                  console.log(`Fetching message uid=${uid}`);
                  try {
                    const buffer = await this.fetchSingleMessage(imap, uid);
                    const parsed = await simpleParser(buffer) as ParsedMail;
                    console.log(`Parsed message uid=${uid} subject="${parsed.subject || ""}"`);
                    messages.push({
                      id: uid.toString(),
                      subject: parsed.subject || "",
                      from: parsed.from ? this.formatAddress(parsed.from) : "",
                      to: parsed.to ? this.formatAddressList(parsed.to) : "",
                      body: (parsed.text || parsed.html || "").substring(0, 10000),
                      date: parsed.date ? new Date(parsed.date).toUTCString() : new Date().toUTCString(),
                      unread: true,
                    });
                  } catch (err) {
                    console.error(`Failed to fetch/parse message uid=${uid}`, err);
                    // Skip message if fetch/parsing fails
                  }
                }

                resolve({ messages, totalCount });
              })().catch(reject);
            });
          } catch (error) {
            reject(error as Error);
          }
        });
      });
    });
  }

  private formatAddress(address: MailAddress | MailAddress[]): string {
    if (!address) return "";
    if (Array.isArray(address)) {
      return this.formatAddress(address[0]);
    }
    return address.text || ''
  }

  private formatAddressList(addressList: MailAddress | MailAddress[]): string {
    if (!addressList) return "";
    if (!Array.isArray(addressList)) {
      return this.formatAddress(addressList);
    }

    return addressList.map((addr) => this.formatAddress(addr)).join(", ");
  }

  async markAsRead(emailId: string): Promise<void> {
    const uid = parseInt(emailId, 10);
    if (isNaN(uid)) {
      throw new Error(`Invalid email ID: ${emailId}`);
    }

    return this.withImapConnection(async (imap) => {
      return new Promise((resolve, reject) => {
        imap.openBox("INBOX", false, (error: Error | null, _box: Box) => {
          if (error || !_box) {
            reject(error || new Error("Failed to open INBOX"));
            return;
          }
          const flags = ["\\Seen"];
          imap.addFlags(uid, flags, (err: Error | null) => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        });
      });
    });
  }

  close(): void {
    if (this.imap) {
      this.imap.end();
      this.imap = null;
    }
  }
}