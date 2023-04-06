import { Role } from "aws-cdk-lib/aws-iam";
import { Code, Function as Fn, Runtime } from "aws-cdk-lib/aws-lambda";
import { Duration, Stack } from "aws-cdk-lib";

interface IHarvestCompletedInput {
  role: Role;
  mpVodPackagingGroupId: string;
}

export function createHarvestCompleteFn(stack: Stack, props: IHarvestCompletedInput): Fn {
  const { role, mpVodPackagingGroupId } = props;

  return new Fn(stack, "harvested-complete-fn", {
    code: Code.fromAsset("./dist"),
    handler: "harvest-complete.handler",
    runtime: Runtime.NODEJS_18_X,
    timeout: Duration.seconds(30),
    role,
    environment: {
      MP_VOD_PACKAGING_GROUP: mpVodPackagingGroupId,
    },
  });
}
