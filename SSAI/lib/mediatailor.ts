/**
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

 import { 
  Aws,
  aws_mediatailor as mediatailor, 
  Fn, 
  CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";

interface MediaTailorParameterReaderProps {
  adDecisionServerUrl: string,
  bumperStartUrl: string,
  bumberEndUrl: string,
  contentSegmentUrl: string,
  adSegmentUrl: string,
  slateAdUrl:string,
  preRolladDecisionServerUrl:string,
  preRollDuration:number,
  adMarkerPassthrough: boolean,
  personalizationThreshold:number
}

export class MediaTailor extends Construct {
 public readonly configEMT: mediatailor.CfnPlaybackConfiguration;
 private HLS_ENDPOINT='HlsConfiguration.ManifestEndpointPrefix';
 private DASH_ENDPOINT='DashConfiguration.ManifestEndpointPrefix';
 private SESSION_ENDPOINT='SessionInitializationEndpointPrefix';
 public readonly EMTEndPointHLS: string;
 public readonly EMTEndPointDASH: string;
 public readonly EMTEndPointSESSION: string;



 constructor(scope: Construct, 
   id: string, 
   configuration: MediaTailorParameterReaderProps,
   endpoint: string
   ){
   super(scope, id);

   const myMediaTailorName=Aws.STACK_NAME + "_EMT-CDK"
   
   //👇 Defining EMP hostname to use as EMT origin
   const mediaPackageHostname = "https://" + Fn.select(2, Fn.split("/", endpoint));
   //👇 Defining configuration Aliases to have one single EMT configuration working for HLS and MPEG DASH (not to be changed to work with this CDK)
   const configurationAliasesValue={
     "player_params.segment_prefix": {
       "hls": "../../../../../../..",
       "dash": "../../../../../../.."
     },
     "player_params.ad_segment_prefix": {
       "hls": "../../../../../../..",
       "dash": "../../../../../../.."
     }
   }

   //👇 Creating EMT config
   this.configEMT = new mediatailor.CfnPlaybackConfiguration(this, 'MyCfnPlaybackConfiguration', {
     adDecisionServerUrl: configuration['adDecisionServerUrl'],
     name: myMediaTailorName,
     videoContentSourceUrl: mediaPackageHostname,
     // the properties below are optional
     availSuppression: {
       mode: 'BEHIND_LIVE_EDGE',
       value: '00:00:00',
     },
     bumper: {
       endUrl: configuration['bumberEndUrl'],
       startUrl: configuration['bumperStartUrl'],
     },
     configurationAliases: configurationAliasesValue,
     cdnConfiguration: {
       adSegmentUrlPrefix: configuration['adSegmentUrl'],
       contentSegmentUrlPrefix: configuration['contentSegmentUrl'],
     },
     dashConfiguration: {
       mpdLocation: 'DISABLED',
       originManifestType: 'MULTI_PERIOD',
     },
     livePreRollConfiguration: {
       adDecisionServerUrl: configuration['preRolladDecisionServerUrl'],
       maxDurationSeconds: configuration['preRollDuration'],
     },
     manifestProcessingRules: {
       adMarkerPassthrough: {
         enabled: configuration['adMarkerPassthrough'],
       },
     },
     personalizationThresholdSeconds: configuration['personalizationThreshold'],
     slateAdUrl: configuration['slateAdUrl'],
   });

   //👇 Exporting endpoint from EMT
   this.EMTEndPointDASH=Fn.getAtt(this.configEMT.logicalId, this.DASH_ENDPOINT).toString()
   this.EMTEndPointHLS=Fn.getAtt(this.configEMT.logicalId, this.HLS_ENDPOINT).toString()
   this.EMTEndPointSESSION=Fn.getAtt(this.configEMT.logicalId, this.SESSION_ENDPOINT).toString()
   
    // MediaTailor
    new CfnOutput(this, "MediaTailorEndpoint-Session", {
      value: this.EMTEndPointSESSION,
      exportName: Aws.STACK_NAME + "mediaTailorSessionEndPoint",
      description: "The session endpoint for MediaTailor Configuration",
    });

 }
}
