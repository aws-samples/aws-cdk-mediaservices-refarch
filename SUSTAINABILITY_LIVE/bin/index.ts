import { App, Aspects } from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
import { MediaLiveStack } from "../lib/stacks/media-services";

const app = new App();
new MediaLiveStack(app);
Aspects.of(app).add(new AwsSolutionsChecks());
