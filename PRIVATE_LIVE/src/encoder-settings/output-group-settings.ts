import { CfnChannel } from "aws-cdk-lib/aws-medialive";

export class MSSOutputGroupSettings {
  constructor(private outputName: string) {}
  private baseProps: CfnChannel.OutputGroupSettingsProperty = {
    msSmoothGroupSettings: {
      destination: {
        destinationRefId: this.outputName,
      },
    },
  };

  public getOutputGroupSettings(): CfnChannel.OutputGroupSettingsProperty {
    return {
      ...this.baseProps,
    };
  }
}
