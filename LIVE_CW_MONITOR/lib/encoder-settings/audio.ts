import { CfnChannel } from "aws-cdk-lib/aws-medialive";
import { Base, OPTIONS } from "./base";

export class AudioAAC extends Base {
  constructor(id: string, private aacProps?: CfnChannel.AacSettingsProperty) {
    super(id, OPTIONS.AUDIO);
  }

  private baseAacSettings: CfnChannel.AacSettingsProperty = {};

  public getAudioProfile(): CfnChannel.AudioDescriptionProperty {
    return {
      codecSettings: {
        aacSettings: {
          ...this.baseAacSettings,
          ...this.aacProps,
        },
      },
      name: this.getUniqueId(),
    };
  }
}
