import { App, CfnOutput, Stack } from "aws-cdk-lib";
import { EmxEntitlementConsumer } from "./emx-construct";
import { ENTITLEMENT_ARN, SECRET_ARN, SNS_ARN } from "./constants/granted-config";
import { ALGORITHM } from "./helpers/algorithm";
import { EmxEntitlementConsumerRole } from "./consumer-role-construct";
import { createMediaLiveInput, createMediaLive } from "./mediaservices/media-live";
import { createMediaPackage, createMediaPackageChannelGroup } from "./mediaservices/media-package";
import { Role } from "aws-cdk-lib/aws-iam";
import { CfnFlow } from "aws-cdk-lib/aws-mediaconnect";
import { CfnDistribution, CfnOriginAccessControl, Distribution, OriginProtocolPolicy, OriginRequestHeaderBehavior, OriginRequestPolicy, OriginRequestQueryStringBehavior, OriginSslPolicy, ViewerProtocolPolicy } from "aws-cdk-lib/aws-cloudfront";
import { HttpOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { NagSuppressions } from "cdk-nag";

export const STACK_PREFIX_NAME = "EMXSecretSharePoC";


export class ConsumeEmxEntitlementStack extends Stack {
  constructor(app: App) {
    super(app, "ConsumeEmxEntitlement", {});
  }

  /**
   * This function just allows a deployment of an IAM role - with no actual permissions (apart from LambdaExecution permissions).
   *
   * This is important for the rest of the deployment of the Construct.
   */
  public createConsumeRole() {
      return new EmxEntitlementConsumerRole(this);
  }

  /**
   * When granter/supplier tells you they're ready - this function is ready to be called next.
   *
   * We signal this from the `bin/index.ts` file. Can only be called once a role has been created and the context variable has been removed.
   */
  public createEntitlementConsumer(role: Role){

    return new EmxEntitlementConsumer(this, {
      entitlementArn: ENTITLEMENT_ARN,
      secretArn: SECRET_ARN,
      snsArn: SNS_ARN,
      encryptionAlgorithm: ALGORITHM.AES256,
      fnRole: role,
    });
  }

  /**
   * Setup AWS Elemental MediaServices Infrastructure to help demonstate and monitor when you are testing this architecture.
   */
  public createStream(flow: CfnFlow){
    const input = createMediaLiveInput(this, flow.attrFlowArn);
    const channelGroup = createMediaPackageChannelGroup(this);

    const myOriginRequestPolicy = new OriginRequestPolicy(this, 'OriginRequestPolicy',
      {
        originRequestPolicyName: "OriginRequestPolicy",
        comment: "Policy to FWD headers to the origin",
        headerBehavior: OriginRequestHeaderBehavior.allowList(
          "Referer",
          "User-Agent",
          "Access-Control-Request-Method",
          "Access-Control-Request-Headers"
        ),
        queryStringBehavior: OriginRequestQueryStringBehavior.allowList("start","end","aws.manifestfilter","_HLS_msn","_HLS_part")
      }
    );
    const distribution = new Distribution(this, "cdn", {
      defaultBehavior: {
        origin: new HttpOrigin(channelGroup.attrEgressDomain, {
          protocolPolicy: OriginProtocolPolicy.HTTPS_ONLY,
          originSslProtocols: [OriginSslPolicy.TLS_V1_2],
        }),
        originRequestPolicy:myOriginRequestPolicy,
        viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
      }
    });
      
    NagSuppressions.addResourceSuppressions(distribution, [
      {
        id: "AwsSolutions-CFR3",
        reason: "Demo Distribution - for production workloads ensure you have access logging enabled.",
      },
      {
        id: "AwsSolutions-CFR4",
        reason: "Sample uses the default CloudFront viewer certificate",
      },
    ]);

    const channel = createMediaPackage(this, channelGroup, distribution);

    createMediaLive(this, {
      input: input,
      mediaPackageChannel: channel.channel,
    });
    
    // Configure OAC to enable access only via CloudFront
    const oac = new CfnOriginAccessControl(this, "oac", {
      originAccessControlConfig: {
        name: "oac-emp",
        originAccessControlOriginType: "mediapackagev2",
        signingBehavior: "always",
        signingProtocol: "sigv4",
      },
    })

    const cfnDistribution = distribution.node.defaultChild as CfnDistribution;
    cfnDistribution.addOverride('Properties.DistributionConfig.Origins.0.OriginAccessControlId',
        oac.ref
    );

    new CfnOutput(this, "hls-output", {
      value: `https://${distribution.distributionDomainName}/out/v1/${channelGroup.channelGroupName}/${channel.channel.channelName}/${channel.endpoint.originEndpointName}/index.m3u8`,
      exportName: `hls-output`,
    });
  }
}
