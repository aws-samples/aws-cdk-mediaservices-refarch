import { CfnChannel } from "aws-cdk-lib/aws-medialive";
import { CfnChannel as MpChannel } from "aws-cdk-lib/aws-mediapackage";

export class MPOutputGroupSettings {
  constructor(private mp: MpChannel) {}

  private baseProps: CfnChannel.OutputGroupSettingsProperty = {
    mediaPackageGroupSettings: {
      destination: {
        destinationRefId: this.mp.ref,
      },
    },
  };

  public getOutputGroupSettings(): CfnChannel.OutputGroupSettingsProperty {
    return {
      ...this.baseProps,
    };
  }
}

export class UDPOutputGroupSettings {
  private baseProps: CfnChannel.OutputGroupSettingsProperty = {
    udpGroupSettings: {},
  };

  public getOutputGroupSettings(): CfnChannel.OutputGroupSettingsProperty {
    return {
      ...this.baseProps,
    };
  }
}
