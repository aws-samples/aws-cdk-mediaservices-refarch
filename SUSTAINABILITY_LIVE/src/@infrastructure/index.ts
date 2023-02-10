import { App, Aspects } from "aws-cdk-lib";
import { createMediaLiveStack } from "./stacks/media-services";
import { AwsSolutionsChecks } from "cdk-nag";

const app = new App();
createMediaLiveStack(app);
Aspects.of(app).add(new AwsSolutionsChecks());
