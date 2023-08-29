import { CfnChannel } from "aws-cdk-lib/aws-medialive";
import { Base, OPTIONS } from "./base";

interface Inputs {
  videoSettings?: string;
  audioSettings?: string[];
}
export class MpOutput extends Base {
  constructor(id: string, private props: Inputs) {
    super(id, OPTIONS.NONE);
  }

  private baseProps: CfnChannel.OutputProperty = {
    outputSettings: {
      mediaPackageOutputSettings: {},
    },
    outputName: this.getUniqueId(),
    videoDescriptionName: this.props.videoSettings,
    audioDescriptionNames: this.props.audioSettings,
    captionDescriptionNames: [],
  };

  public getOutputSettings(): CfnChannel.OutputProperty {
    return this.baseProps;
  }
}
