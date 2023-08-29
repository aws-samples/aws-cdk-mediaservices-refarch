import { App, CfnOutput, Duration, Stack } from "aws-cdk-lib";
import { STACK_PREFIX_NAME } from "./media-services";
import { Dashboard, GraphWidget, MathExpression, Metric, SingleValueWidget, TextWidget } from "aws-cdk-lib/aws-cloudwatch";

export class MonitoringStack extends Stack {
  constructor(app: App, private emlChannelId: string, private empChannelId: string) {
    super(app, `${STACK_PREFIX_NAME}-live-cw-monitoring-stack`, {
      env: {
        region: process.env.CDK_DEFAULT_REGION,
        account: process.env.CDK_DEFAULT_ACCOUNT,
      },
    });
  }
  private emlActiveAlertsWidget = new SingleValueWidget({
    height: 4,
    width: 12,
    metrics: [
      new MathExpression({
        expression: `SELECT MAX(ActiveAlerts) FROM MediaLive WHERE ChannelId = '${this.emlChannelId}' GROUP BY Pipeline`,
        searchRegion: this.region,
        period: Duration.minutes(1),
        label: `Pipeline`,
      }),
    ],
    region: this.region,
    title: `EML Active Alerts`,
    sparkline: true,
    setPeriodToTimeRange: false,
    fullPrecision: false,
  });

  private emlPrimaryInputActiveWidget = new SingleValueWidget({
    height: 4,
    width: 12,
    metrics: [
      new MathExpression({
        expression: `SELECT MIN(PrimaryInputActive) FROM "AWS/MediaLive" WHERE ChannelId='${this.emlChannelId}' GROUP BY Pipeline`,
        searchRegion: this.region,
        period: Duration.minutes(1),
        label: `Pipeline`,
      }),
    ],
    region: this.region,
    title: `PrimaryInputActive`,
    sparkline: true,
    setPeriodToTimeRange: false,
    fullPrecision: false,
  });

  private emlNetworkInGraph = new GraphWidget({
    height: 6,
    width: 12,
    left: [
      new MathExpression({
        expression: `SELECT MAX(NetworkIn) FROM SCHEMA("AWS/MediaLive", ChannelId,Pipeline) WHERE ChannelId = '${this.emlChannelId}' GROUP BY Pipeline`,
        searchRegion: this.region,
        period: Duration.minutes(1),
        label: `Pipeline`,
      }),
    ],
    stacked: true,
    region: this.region,
    title: `EML Network In`,
    setPeriodToTimeRange: true,
    period: Duration.minutes(1),
    liveData: true,
  });

  private emlNetworkOutGraph = new GraphWidget({
    height: 6,
    width: 12,
    left: [
      new MathExpression({
        expression: `SELECT MAX(NetworkOut) FROM SCHEMA("AWS/MediaLive", ChannelId,Pipeline) WHERE ChannelId = '${this.emlChannelId}' GROUP BY Pipeline`,
        searchRegion: this.region,
        period: Duration.minutes(1),
        label: `Pipeline`,
      }),
    ],
    stacked: true,
    region: this.region,
    title: `EML Network Out`,
    setPeriodToTimeRange: true,
    period: Duration.minutes(1),
    liveData: true,
  });

  private emlInputFrameRateGraph = new GraphWidget({
    height: 6,
    width: 12,
    left: [
      new MathExpression({
        expression: `SELECT MAX(InputVideoFrameRate) FROM MediaLive WHERE ChannelId='${this.emlChannelId}' GROUP BY Pipeline`,
        searchRegion: this.region,
        period: Duration.minutes(1),
        label: ``,
      }),
    ],
    region: this.region,
    title: `Input Frame Rate`,
    setPeriodToTimeRange: true,
    period: Duration.minutes(1),
  });
  private emlActiveInputsGraph = new GraphWidget({
    height: 6,
    width: 12,
    left: [
      new MathExpression({
        expression: `SELECT MIN(ActiveOutputs) FROM MediaLive WHERE ChannelId='${this.emlChannelId}' GROUP BY OutputGroupName, Pipeline`,
        searchRegion: this.region,
        period: Duration.minutes(1),
        label: ``,
      }),
    ],
    region: this.region,
    title: `Active Outputs`,
    setPeriodToTimeRange: true,
    period: Duration.minutes(1),
  });

  private emlRequest4xxGraph = new GraphWidget({
    height: 6,
    width: 12,
    left: [
      new MathExpression({
        expression: `SELECT SUM(Output4xxErrors) FROM MediaLive WHERE ChannelId = '${this.emlChannelId}' GROUP BY OutputGroupName, Pipeline`,
        searchRegion: this.region,
        period: Duration.minutes(1),
        label: ``,
      }),
    ],
    region: this.region,
    title: `Output 4xx (HLS/EMP Outputs)`,
    setPeriodToTimeRange: true,
    period: Duration.minutes(1),
  });

  private emlRequest5xxGraph = new GraphWidget({
    height: 6,
    width: 12,
    left: [
      new MathExpression({
        expression: `SELECT SUM(Output5xxErrors) FROM MediaLive WHERE ChannelId = '${this.emlChannelId}' GROUP BY OutputGroupName, Pipeline`,
        searchRegion: this.region,
        period: Duration.minutes(1),
        label: ``,
      }),
    ],
    region: this.region,
    title: `Output 5xx (HLS/EMP Outputs)`,
    setPeriodToTimeRange: true,
    period: Duration.minutes(1),
  });

  private emlSvqTimeGraph = new GraphWidget({
    height: 6,
    width: 6,
    left: [
      new MathExpression({
        expression: `SELECT MAX(SvqTime) FROM MediaLive WHERE ChannelId='${this.emlChannelId}' GROUP BY Pipeline`,
        searchRegion: this.region,
        period: Duration.minutes(1),
        label: ``,
      }),
    ],
    region: this.region,
    title: `Svq Time`,
    setPeriodToTimeRange: true,
    period: Duration.minutes(1),
  });

  private emlFillMSecTimeGraph = new GraphWidget({
    height: 6,
    width: 6,
    left: [
      new MathExpression({
        expression: `SELECT MAX(FillMsec) FROM SCHEMA("AWS/MediaLive", ChannelId,Pipeline) WHERE ChannelId = '${this.emlChannelId}' GROUP BY Pipeline`,
        searchRegion: this.region,
        period: Duration.minutes(1),
        label: ``,
      }),
    ],
    region: this.region,
    title: `Fill MSec`,
    setPeriodToTimeRange: true,
    period: Duration.minutes(1),
  });

  private emlInputLossSecondsTimeGraph = new GraphWidget({
    height: 6,
    width: 6,
    left: [
      new MathExpression({
        expression: `SELECT SUM(InputLossSeconds) FROM MediaLive WHERE ChannelId='${this.emlChannelId}' GROUP BY Pipeline`,
        searchRegion: this.region,
        period: Duration.minutes(1),
        label: `Pipeline`,
      }),
    ],
    region: this.region,
    title: `Input Loss Seconds`,
    setPeriodToTimeRange: true,
    period: Duration.minutes(1),
  });

  private emlDroppedFramesTimeGraph = new GraphWidget({
    height: 6,
    width: 6,
    left: [
      new MathExpression({
        expression: `SELECT SUM(DroppedFrames) FROM MediaLive WHERE ChannelId='${this.emlChannelId}' GROUP BY Pipeline`,
        searchRegion: this.region,
        period: Duration.minutes(1),
        label: `Pipeline`,
      }),
    ],
    region: this.region,
    title: `Dropped Frames`,
    setPeriodToTimeRange: true,
    period: Duration.minutes(1),
  });

  private metric = new Metric({
    namespace: `AWS/MediaPackage`,
    metricName: `EgressBytes`,
    dimensionsMap: {
      Channel: this.empChannelId,
    },
    period: Duration.minutes(1),
    statistic: "Sum",
  });

  private metricIngress = new Metric({
    namespace: `AWS/MediaPackage`,
    metricName: `IngressBytes`,
    dimensionsMap: {
      Channel: this.empChannelId,
    },
    period: Duration.minutes(1),
    statistic: "Sum",
  });

  private empEgressRequestsGraph = new GraphWidget({
    height: 6,
    width: 12,
    left: [this.metric, this.metricIngress],
    region: this.region,
    title: `Egress and Ingress Request`,
    setPeriodToTimeRange: true,
    period: Duration.minutes(1),
    statistic: "Sum",
  });

  private metricEgressRequestCount2xx = new Metric({
    namespace: `AWS/MediaPackage`,
    metricName: `EgressRequestCount`,
    dimensionsMap: {
      Channel: `${this.empChannelId}`,
      StatusCodeRange: "2xx",
    },
  });
  private metricEgressRequestCount4xx = new Metric({
    namespace: `AWS/MediaPackage`,
    metricName: `EgressRequestCount`,
    dimensionsMap: {
      Channel: `${this.empChannelId}`,
      StatusCodeRange: "2xx",
    },
  });

  private empEgressByEndpoint = new GraphWidget({
    height: 6,
    width: 12,
    left: [
      new MathExpression({
        expression: `SELECT SUM(EgressBytes) FROM SCHEMA("AWS/MediaPackage", Channel,OriginEndpoint) WHERE Channel='${this.empChannelId}' GROUP BY OriginEndpoint`,
        searchRegion: this.region,
        period: Duration.minutes(1),
        label: ``,
      }),
    ],
    region: this.region,
    title: `Egress bytes per endpoint`,
    setPeriodToTimeRange: true,
    period: Duration.minutes(1),
  });

  private empEgressRequestCountGraph = new GraphWidget({
    height: 6,
    width: 12,
    left: [this.metricEgressRequestCount2xx, this.metricEgressRequestCount4xx],
    region: this.region,
    title: `Egress Requests`,
    setPeriodToTimeRange: true,
    period: Duration.minutes(1),
    statistic: "Sum",
  });

  private dashboard = new Dashboard(this, "refarch-monitoring-dashboard", {
    widgets: [
      [
        new TextWidget({
          markdown: `# EML Channel ${this.emlChannelId}`,
          width: 24,
        }),
      ],
      [this.emlActiveAlertsWidget, this.emlPrimaryInputActiveWidget],
      [this.emlNetworkInGraph, this.emlNetworkOutGraph],
      [this.emlRequest4xxGraph, this.emlRequest5xxGraph],
      [this.emlInputFrameRateGraph, this.emlActiveInputsGraph],
      [this.emlInputLossSecondsTimeGraph, this.emlSvqTimeGraph, this.emlFillMSecTimeGraph, this.emlDroppedFramesTimeGraph],
      [
        new TextWidget({
          markdown: `# EMP Channel ${this.empChannelId}`,
          width: 24,
        }),
      ],
      [this.empEgressRequestsGraph, this.empEgressRequestCountGraph],
      [this.empEgressByEndpoint],
    ],
  });

  private outputs = [
    new CfnOutput(this, "monitoring-dashboard-name", {
      value: this.dashboard.dashboardName,
    }),
  ];
}
