import { App, Aspects } from "aws-cdk-lib";
import { createthumbnailApiStack } from "./stacks/thumbnail-api";
import { AwsSolutionsChecks } from "cdk-nag";

export const STACK_PREFIX_NAME = "MediaServicesRefArch";

const app = new App();
createthumbnailApiStack(app);
Aspects.of(app).add(new AwsSolutionsChecks());
