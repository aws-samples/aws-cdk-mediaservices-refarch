import { CfnChannel } from "aws-cdk-lib/aws-medialive";
import { Base, OPTIONS } from "./base";

interface IVideo {
  height: number;
  width: number;
}

type H264BaseSettings = Omit<CfnChannel.H264SettingsProperty, "bitrate">;
interface H264Settings extends H264BaseSettings {
  bitrate: number;
}

export class VideoH264 extends Base {
  constructor(private id: string, private resolutionProps: IVideo, private h264Props: H264Settings) {
    super(id, OPTIONS.VIDEO);
  }

  private baseH264Props: H264BaseSettings = {
    framerateControl: "SPECIFIED",
    framerateNumerator: 25,
    framerateDenominator: 1,
    gopSize: 2,
    gopSizeUnits: "SECONDS",
    parControl: "SPECIFIED",
    parNumerator: 1,
    parDenominator: 1,
  };

  public getVideoProfile(): CfnChannel.VideoDescriptionProperty {
    return {
      codecSettings: {
        h264Settings: {
          ...this.baseH264Props,
          ...this.h264Props,
        },
      },
      height: this.resolutionProps.height,
      name: this.getUniqueId(),
      width: this.resolutionProps.width,
    };
  }
}
