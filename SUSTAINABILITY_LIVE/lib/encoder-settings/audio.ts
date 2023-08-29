import { CfnChannel } from "aws-cdk-lib/aws-medialive";
import { Base, OPTIONS } from "./base";

/**
 * If ID is updated - the codec settings name is also updated (equivalent to CF recreated)
 */
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
