import { CfnChannel } from "aws-cdk-lib/aws-medialive";

export class UdpOutputGroupSettings {

  private baseProps: CfnChannel.OutputGroupSettingsProperty = {
    udpGroupSettings: {
      inputLossAction: "EMIT_PROGRAM",
    },
  };

  public getOutputGroupSettings(): CfnChannel.OutputGroupSettingsProperty {
    return {
      ...this.baseProps,
    };
  }
}
