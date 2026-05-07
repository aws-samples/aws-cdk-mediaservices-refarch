import { IEventGroupConfig } from "../../lib/event_group/eventGroupConfigInterface";

export const EVENT_GROUP_CONFIG: IEventGroupConfig = {
  cloudFront: {
    nominalSegmentLength: 4,
    s3LoggingEnabled: true,
    enableIpv6: true,
    tokenizationFunctionArn: "",
    waf: {
      /**
       * Uncomment to enable WAF protection for CloudFront distribution
       * A separate WAF stack will be automatically created in us-east-1
       */
      // enabled: true,
      /**
       * Optional: Use existing Web ACL ARN instead of creating a new one.
       * If webAclArn is provided, no new WAF stack will be created.  If not
       * provided then at least one rule must be configured below.
       */
      // webAclArn: "arn:aws:wafv2:us-east-1:123456789012:global/webacl/example/a1b2c3d4-5678-90ab-cdef-EXAMPLE11111",
      /**
       * Optional: List of IPv4 addresses to allow in CIDR format (bypasses all other rules)
       */
      // allowedIpv4Addresses: ["192.0.2.0/24", "198.51.100.0/24"],
      /**
       * Optional: List of 2-letter country codes to allow (blocks all others)
       * Uses ISO 3166-1 alpha-2 codes: https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2
       */
      // allowedCountryCodes: ["US", "AU", "GB"],
      /**
       * Optional: Block anonymous IPs (VPNs, proxies, Tor) - default: false
       */
      // blockAnonymousIps: true,
    },
  },
  mediaTailor: [
    {
      name: "",
      adDecisionServerUrl:
        "https://n8ljfs0h09.execute-api.us-west-2.amazonaws.com/v1/ads?duration=[session.avail_duration_secs]&availIndex=[avail.index]&scor=[session.id]&correlator=[avail.random]",
      contentSegmentUrlPrefix: "/",
      adSegmentUrlPrefix: "/",
      slateAdUrl:
        "https://d1zxfw9n55b23r.cloudfront.net/interstitials/SlateAd.mov",
      logPercentageEnabled: 10,
      insertionMode: "PLAYER_SELECT",
      // Bumpers can be enabled by uncommenting the 'bumper' section below.
      // bumper: {
      //   startUrl: 'https://d1zxfw9n55b23r.cloudfront.net/interstitials/Bumper.mov',
      //   endUrl: 'https://d1zxfw9n55b23r.cloudfront.net/interstitials/Bumper.mov',
      // },
    },
  ],
  // MediaPackage V2 access logging configuration
  // Logging is disabled by default to avoid unexpected CloudWatch vended log charges
  // To enable logging, set enabled: true and configure desired destinations
  mediaPackageLogging: {
    enabled: false,
    egressAccessLogs: [
      {
        destinationType: "CLOUDWATCH_LOGS",
        retentionInDays: 30,
        outputFormat: "json",
      },
    ],
    ingressAccessLogs: [
      {
        destinationType: "CLOUDWATCH_LOGS",
        retentionInDays: 30,
        outputFormat: "json",
      },
    ],
  },
};
