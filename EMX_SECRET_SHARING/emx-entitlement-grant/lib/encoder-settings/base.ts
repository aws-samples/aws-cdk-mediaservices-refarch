import { createHash } from "crypto";

export enum OPTIONS {
  AUDIO = "audio",
  VIDEO = "video",
  NONE = "none",
}

export class Base {
  constructor(private parentId: string, private option: OPTIONS) {}

  private generatedId: string = createHash("md5").update(this.parentId).digest("hex").toString().substring(0, 5);
  protected uniqueId = this.generalUniqueName(this.generatedId, this.option);

  public getUniqueId(): string {
    return this.uniqueId;
  }

  private generalUniqueName(id: string, prefixOptions: OPTIONS): string {
    return `${prefixOptions != OPTIONS.NONE ? `${prefixOptions}_` : ""}${id}`;
  }
}
