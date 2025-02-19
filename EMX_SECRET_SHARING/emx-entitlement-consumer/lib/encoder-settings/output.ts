import { CfnChannel } from "aws-cdk-lib/aws-medialive";
import { Base, OPTIONS } from "./base";

export class MpOutput extends Base {
  constructor(id: string, private nameModifier: string, private props: { videoSettings: string } | {audioSettings: string}) {
    super(id, OPTIONS.NONE);
  }

  private baseProps: CfnChannel.OutputProperty = {
    outputSettings: {
      cmafIngestOutputSettings: {
        nameModifier: this.nameModifier,
      },
    },
    outputName: this.getUniqueId(),
    videoDescriptionName: "videoSettings" in this.props ? this.props.videoSettings : undefined,
    audioDescriptionNames: "audioSettings" in this.props ? [this.props.audioSettings] : undefined,
  };

  public getOutputSettings(): CfnChannel.OutputProperty {
    return this.baseProps;
  }
}
