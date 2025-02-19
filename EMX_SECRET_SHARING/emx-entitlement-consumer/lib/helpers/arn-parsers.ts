
export function parseEntitlementArn(arn: string){
    const splitArn = arn.split(":");
    return splitArn[splitArn.length-1];
  }

