import { App, Aspects } from "aws-cdk-lib";
import { AudioOnlyEndcodingStack } from "./stack/encoding-stack";
import { AwsSolutionsChecks } from "cdk-nag";

export const STACK_PREFIX_NAME = "MediaServicesRefArch";

const app = new App();
new AudioOnlyEndcodingStack(app);
Aspects.of(app).add(new AwsSolutionsChecks());
