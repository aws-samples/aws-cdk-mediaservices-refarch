import { CfnChannel } from "aws-cdk-lib/aws-medialive";
import { Base, OPTIONS } from "./base";

export class OutputGroups extends Base {
  constructor(id: string, private videoSettings: string, private audioSettings: string) {
    super(id, OPTIONS.NONE);
  }

  private baseProps: CfnChannel.OutputProperty = {
    outputSettings: {
      msSmoothOutputSettings: {},
    },
    outputName: this.getUniqueId(),
    videoDescriptionName: this.videoSettings,
    audioDescriptionNames: [this.audioSettings],
    captionDescriptionNames: [],
  };

  public getOutputSettings(): CfnChannel.OutputProperty {
    return this.baseProps;
  }
}
