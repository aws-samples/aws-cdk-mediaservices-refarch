import { App, Aspects } from "aws-cdk-lib";
import { getAudioOnlyEndcodingStack } from "./stack/encoding-stack";
import { AwsSolutionsChecks } from "cdk-nag";

export const STACK_PREFIX_NAME = "MediaServicesRefArch";

const app = new App();
getAudioOnlyEndcodingStack(app);
Aspects.of(app).add(new AwsSolutionsChecks());
