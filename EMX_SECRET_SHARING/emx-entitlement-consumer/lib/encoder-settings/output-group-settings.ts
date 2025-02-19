import { CfnChannel } from "aws-cdk-lib/aws-medialive";

export class MPOutputGroupSettings {
  constructor(private output: string) {}

  private baseProps: CfnChannel.OutputGroupSettingsProperty = {
    cmafIngestGroupSettings: {
      destination: {
        destinationRefId: this.output
      },
    }
  };

  public getOutputGroupSettings(): CfnChannel.OutputGroupSettingsProperty {
    return {
      ...this.baseProps,
    };
  }
}
