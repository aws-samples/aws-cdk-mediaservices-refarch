import { App, CfnOutput, Duration, Stack } from "aws-cdk-lib";
import { STACK_PREFIX_NAME } from "./media-services";
import { Dashboard, GraphWidget, MathExpression, Metric, SingleValueWidget, TextWidget } from "aws-cdk-lib/aws-cloudwatch";

export function getMonitoringStack(app: App, emlChannelId: string, empChannelId: string) {
  const stack = new Stack(app, `${STACK_PREFIX_NAME}-live-cw-monitoring-stack`, {
    env: {
      region: process.env.CDK_DEFAULT_REGION,
      account: process.env.CDK_DEFAULT_ACCOUNT,
    },
  });

  const emlActiveAlertsWidget = new SingleValueWidget({
    height: 4,
    width: 12,
    metrics: [
      new MathExpression({
        expression: `SELECT MAX(ActiveAlerts) FROM MediaLive WHERE ChannelId = '${emlChannelId}' GROUP BY Pipeline`,
        searchRegion: stack.region,
        period: Duration.minutes(1),
        label: `Pipeline`,
      }),
    ],
    region: stack.region,
    title: `EML Active Alerts`,
    sparkline: true,
    setPeriodToTimeRange: false,
    fullPrecision: false,
  });

  const emlPrimaryInputActiveWidget = new SingleValueWidget({
    height: 4,
    width: 12,
    metrics: [
      new MathExpression({
        expression: `SELECT MIN(PrimaryInputActive) FROM "AWS/MediaLive" WHERE ChannelId='${emlChannelId}' GROUP BY Pipeline`,
        searchRegion: stack.region,
        period: Duration.minutes(1),
        label: `Pipeline`,
      }),
    ],
    region: stack.region,
    title: `PrimaryInputActive`,
    sparkline: true,
    setPeriodToTimeRange: false,
    fullPrecision: false,
  });

  const emlNetworkInGraph = new GraphWidget({
    height: 6,
    width: 12,
    left: [
      new MathExpression({
        expression: `SELECT MAX(NetworkIn) FROM SCHEMA("AWS/MediaLive", ChannelId,Pipeline) WHERE ChannelId = '${emlChannelId}' GROUP BY Pipeline`,
        searchRegion: stack.region,
        period: Duration.minutes(1),
        label: `Pipeline`,
      }),
    ],
    stacked: true,
    region: stack.region,
    title: `EML Network In`,
    setPeriodToTimeRange: true,
    period: Duration.minutes(1),
    liveData: true,
  });

  const emlNetworkOutGraph = new GraphWidget({
    height: 6,
    width: 12,
    left: [
      new MathExpression({
        expression: `SELECT MAX(NetworkOut) FROM SCHEMA("AWS/MediaLive", ChannelId,Pipeline) WHERE ChannelId = '${emlChannelId}' GROUP BY Pipeline`,
        searchRegion: stack.region,
        period: Duration.minutes(1),
        label: `Pipeline`,
      }),
    ],
    stacked: true,
    region: stack.region,
    title: `EML Network Out`,
    setPeriodToTimeRange: true,
    period: Duration.minutes(1),
    liveData: true,
  });

  const emlInputFrameRateGraph = new GraphWidget({
    height: 6,
    width: 12,
    left: [
      new MathExpression({
        expression: `SELECT MAX(InputVideoFrameRate) FROM MediaLive WHERE ChannelId='${emlChannelId}' GROUP BY Pipeline`,
        searchRegion: stack.region,
        period: Duration.minutes(1),
        label: ``,
      }),
    ],
    region: stack.region,
    title: `Input Frame Rate`,
    setPeriodToTimeRange: true,
    period: Duration.minutes(1),
  });
  const emlActiveInputsGraph = new GraphWidget({
    height: 6,
    width: 12,
    left: [
      new MathExpression({
        expression: `SELECT MIN(ActiveOutputs) FROM MediaLive WHERE ChannelId='${emlChannelId}' GROUP BY OutputGroupName, Pipeline`,
        searchRegion: stack.region,
        period: Duration.minutes(1),
        label: ``,
      }),
    ],
    region: stack.region,
    title: `Active Outputs`,
    setPeriodToTimeRange: true,
    period: Duration.minutes(1),
  });

  const emlRequest4xxGraph = new GraphWidget({
    height: 6,
    width: 12,
    left: [
      new MathExpression({
        expression: `SELECT SUM(Output4xxErrors) FROM MediaLive WHERE ChannelId = '${emlChannelId}' GROUP BY OutputGroupName, Pipeline`,
        searchRegion: stack.region,
        period: Duration.minutes(1),
        label: ``,
      }),
    ],
    region: stack.region,
    title: `Output 4xx (HLS/EMP Outputs)`,
    setPeriodToTimeRange: true,
    period: Duration.minutes(1),
  });

  const emlRequest5xxGraph = new GraphWidget({
    height: 6,
    width: 12,
    left: [
      new MathExpression({
        expression: `SELECT SUM(Output5xxErrors) FROM MediaLive WHERE ChannelId = '${emlChannelId}' GROUP BY OutputGroupName, Pipeline`,
        searchRegion: stack.region,
        period: Duration.minutes(1),
        label: ``,
      }),
    ],
    region: stack.region,
    title: `Output 5xx (HLS/EMP Outputs)`,
    setPeriodToTimeRange: true,
    period: Duration.minutes(1),
  });

  const emlSvqTimeGraph = new GraphWidget({
    height: 6,
    width: 6,
    left: [
      new MathExpression({
        expression: `SELECT MAX(SvqTime) FROM MediaLive WHERE ChannelId='${emlChannelId}' GROUP BY Pipeline`,
        searchRegion: stack.region,
        period: Duration.minutes(1),
        label: ``,
      }),
    ],
    region: stack.region,
    title: `Svq Time`,
    setPeriodToTimeRange: true,
    period: Duration.minutes(1),
  });

  const emlFillMSecTimeGraph = new GraphWidget({
    height: 6,
    width: 6,
    left: [
      new MathExpression({
        expression: `SELECT MAX(FillMsec) FROM SCHEMA("AWS/MediaLive", ChannelId,Pipeline) WHERE ChannelId = '${emlChannelId}' GROUP BY Pipeline`,
        searchRegion: stack.region,
        period: Duration.minutes(1),
        label: ``,
      }),
    ],
    region: stack.region,
    title: `Fill MSec`,
    setPeriodToTimeRange: true,
    period: Duration.minutes(1),
  });

  const emlInputLossSecondsTimeGraph = new GraphWidget({
    height: 6,
    width: 6,
    left: [
      new MathExpression({
        expression: `SELECT SUM(InputLossSeconds) FROM MediaLive WHERE ChannelId='${emlChannelId}' GROUP BY Pipeline`,
        searchRegion: stack.region,
        period: Duration.minutes(1),
        label: `Pipeline`,
      }),
    ],
    region: stack.region,
    title: `Input Loss Seconds`,
    setPeriodToTimeRange: true,
    period: Duration.minutes(1),
  });

  const emlDroppedFramesTimeGraph = new GraphWidget({
    height: 6,
    width: 6,
    left: [
      new MathExpression({
        expression: `SELECT SUM(DroppedFrames) FROM MediaLive WHERE ChannelId='${emlChannelId}' GROUP BY Pipeline`,
        searchRegion: stack.region,
        period: Duration.minutes(1),
        label: `Pipeline`,
      }),
    ],
    region: stack.region,
    title: `Dropped Frames`,
    setPeriodToTimeRange: true,
    period: Duration.minutes(1),
  });

  const metric = new Metric({
    namespace: `AWS/MediaPackage`,
    metricName: `EgressBytes`,
    dimensionsMap: {
      Channel: empChannelId,
    },
    period: Duration.minutes(1),
    statistic: "Sum",
  });

  const metricIngress = new Metric({
    namespace: `AWS/MediaPackage`,
    metricName: `IngressBytes`,
    dimensionsMap: {
      Channel: empChannelId,
    },
    period: Duration.minutes(1),
    statistic: "Sum",
  });

  const empEgressRequestsGraph = new GraphWidget({
    height: 6,
    width: 12,
    left: [metric, metricIngress],
    region: stack.region,
    title: `Egress and Ingress Request`,
    setPeriodToTimeRange: true,
    period: Duration.minutes(1),
    statistic: "Sum",
  });

  const metricEgressRequestCount2xx = new Metric({
    namespace: `AWS/MediaPackage`,
    metricName: `EgressRequestCount`,
    dimensionsMap: {
      Channel: `${empChannelId}`,
      StatusCodeRange: "2xx",
    },
  });
  const metricEgressRequestCount4xx = new Metric({
    namespace: `AWS/MediaPackage`,
    metricName: `EgressRequestCount`,
    dimensionsMap: {
      Channel: `${empChannelId}`,
      StatusCodeRange: "2xx",
    },
  });

  const empEgressByEndpoint = new GraphWidget({
    height: 6,
    width: 12,
    left: [
      new MathExpression({
        expression: `SELECT SUM(EgressBytes) FROM SCHEMA("AWS/MediaPackage", Channel,OriginEndpoint) WHERE Channel='${empChannelId}' GROUP BY OriginEndpoint`,
        searchRegion: stack.region,
        period: Duration.minutes(1),
        label: ``,
      }),
    ],
    region: stack.region,
    title: `Egress bytes per endpoint`,
    setPeriodToTimeRange: true,
    period: Duration.minutes(1),
  });

  const empEgressRequestCountGraph = new GraphWidget({
    height: 6,
    width: 12,
    left: [metricEgressRequestCount2xx, metricEgressRequestCount4xx],
    region: stack.region,
    title: `Egress Requests`,
    setPeriodToTimeRange: true,
    period: Duration.minutes(1),
    statistic: "Sum",
  });

  const dashboard = new Dashboard(stack, "refarch-monitoring-dashboard", {
    widgets: [
      [
        new TextWidget({
          markdown: `# EML Channel ${emlChannelId}`,
          width: 24,
        }),
      ],
      [emlActiveAlertsWidget, emlPrimaryInputActiveWidget],
      [emlNetworkInGraph, emlNetworkOutGraph],
      [emlRequest4xxGraph, emlRequest5xxGraph],
      [emlInputFrameRateGraph, emlActiveInputsGraph],
      [emlInputLossSecondsTimeGraph, emlSvqTimeGraph, emlFillMSecTimeGraph, emlDroppedFramesTimeGraph],
      [
        new TextWidget({
          markdown: `# EMP Channel ${empChannelId}`,
          width: 24,
        }),
      ],
      [empEgressRequestsGraph, empEgressRequestCountGraph],
      [empEgressByEndpoint],
    ],
  });

  new CfnOutput(stack, "monitoring-dashboard-name", {
    value: dashboard.dashboardName,
  });
}
