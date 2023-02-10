import { CfnChannel } from "aws-cdk-lib/aws-medialive";
import { Base, OPTIONS } from "./base";

export class MpOutput extends Base {
  constructor(id: string, private videoSettings: string, private audioSettings: string) {
    super(id, OPTIONS.NONE);
  }

  private baseProps: CfnChannel.OutputProperty = {
    outputSettings: {
      mediaPackageOutputSettings: {},
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

export class UdpOutput extends Base {
  constructor(id: string, private videoSettings: string, private audioSettings: string) {
    super(id, OPTIONS.NONE);
  }

  private baseProps: CfnChannel.OutputProperty = {
    outputSettings: {
      udpOutputSettings: {
        containerSettings: {
          m2TsSettings: {},
        },
        destination: {
          destinationRefId: this.getUniqueId(),
        },
      },
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
