import Imap from "imap";
import { simpleParser } from "mailparser";
import { Box } from "imap";

// Type definitions for mailparser
interface MailAddress {
  address?: string;
  name?: string;
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
  maxResults?: number;
  unreadOnly?: boolean;
  query?: string;
  pageToken?: string;
}

export interface ListEmailsResponse {
  messages: EmailMessage[];
  totalCount?: number;
  nextPageToken?: string;
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

  async listEmails(options: ListEmailsOptions = {}): Promise<ListEmailsResponse> {
    const maxResults = options.maxResults || 10;
    const unreadOnly = options.unreadOnly !== false;
    const pageToken = options.pageToken;
    const query = options.query;

    return await this.withImapConnection(async (imap) => {
      return new Promise((resolve, reject) => {
        imap.openBox("INBOX", false, (error: Error | null, _box: Box) => {
          if (error || !_box) {
            reject(error || new Error("Failed to open INBOX"));
            return;
          }

          try {
            const searchCriteria: string[] = [];
            if (unreadOnly) {
              searchCriteria.push("UNSEEN");
            }
            if (query) {
              const queries = query.split(/\s+/);
              for (const q of queries) {
                if (q.toLowerCase().startsWith("from:")) {
                  searchCriteria.push("FROM", `"${q.substring(5)}"`);
                } else if (q.toLowerCase().startsWith("subject:")) {
                  searchCriteria.push("SUBJECT", `"${q.substring(8)}"`);
                } else if (q.toLowerCase().startsWith("body:")) {
                  searchCriteria.push("TEXT", `"${q.substring(5)}"`);
                } else if (q.toLowerCase().startsWith("date:")) {
                  searchCriteria.push("SINCE", `"${q.substring(5)}"`);
                } else {
                  searchCriteria.push("TEXT", `"${q}"`);
                }
              }
            }

            let startUid = 1;
            if (pageToken) {
              try {
                startUid = parseInt(pageToken, 10);
              } catch (_e) {
                startUid = 1;
              }
            }

            const criteria = searchCriteria.length > 0 ? searchCriteria : ["ALL"];
            imap.search(criteria, (_err: Error | null, results: number[]) => {
              const sortedUids = results.sort((a: number, b: number) => b - a);
              const totalCount = sortedUids.length;

              let startIndex = 0;
              if (pageToken) {
                startIndex = sortedUids.indexOf(startUid);
                if (startIndex === -1) {
                  startIndex = 0;
                } else {
                  startIndex++;
                }
              }

              const endIndex = Math.min(startIndex + maxResults, sortedUids.length);
              const pageUids = sortedUids.slice(startIndex, endIndex);

              if (pageUids.length === 0) {
                resolve({ messages: [], totalCount, nextPageToken: undefined });
                return;
              }

              const uidList = pageUids.join(",");
              const uidMap = new Map<number, number>();

              const fetchWithUid = (imap: Imap, uidList: string, onUid: (seqno: number, uid: number) => void): Promise<string[]> => {
                return new Promise((resolve, reject) => {
                  const uidFetch = imap.fetch(uidList, {
                    bodies: [""],
                    struct: true,
                    envelope: true,
                  });

                  const buffers: string[] = [];

                  uidFetch.on("message", (msg: MailMessage, seqno: number) => {
                    let buffer = "";
                    msg.on("attributes", (attrs: FetchAttributes) => {
                      onUid(seqno, attrs.uid!);
                    });
                    msg.on("body", (stream: NodeJS.ReadStream) => {
                      stream.on("data", (chunk: Buffer) => {
                        buffer += chunk.toString("utf8");
                      });
                      stream.on("end", () => {});
                    });
                    msg.on("end", () => {
                      buffers.push(buffer);
                    });
                  });

                  uidFetch.on("error", (err: Error) => reject(err));
                  uidFetch.on("end", () => resolve(buffers));
                });
              };

              fetchWithUid(imap, uidList, (seqno, uid) => {
                uidMap.set(seqno, uid);
              })
                .then(async (buffers) => {
                  const messages: EmailMessage[] = [];
                  for (let i = 0; i < buffers.length; i++) {
                    const buffer = buffers[i];
                    const uid = uidMap.get(i + 1);
                    try {
                      const parsed = await simpleParser(buffer) as ParsedMail;
                      messages.push({
                        id: uid?.toString(),
                        subject: parsed.subject || "",
                        from: parsed.from ? this.formatAddress(parsed.from) : "",
                        to: parsed.to ? this.formatAddressList(parsed.to) : "",
                        body: (parsed.text || parsed.html || "").substring(0, 10000),
                        date: parsed.date ? new Date(parsed.date).toISOString() : new Date().toISOString(),
                        unread: true,
                      });
                    } catch (err) {
                      // Skip message if parsing fails
                    }
                  }

                  let nextPageToken: string | undefined;
                  if (endIndex < sortedUids.length) {
                    nextPageToken = sortedUids[endIndex].toString();
                  }

                  resolve({ messages, totalCount, nextPageToken });
                })
                .catch(reject);
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
    const addr = address.address;
    const name = address.name;
    if (name && addr) {
      return `"${name}" <${addr}>`;
    }
    return addr || "";
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