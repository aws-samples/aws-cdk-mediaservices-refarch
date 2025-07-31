import { App, Aspects } from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
import { NetworkStack } from "../lib/stacks/networking";
import { MediaLiveStack } from "../lib//stacks/media-services";

export const STACK_PREFIX_NAME = "MediaServicesRefArch";

const app = new App();
const networkStack = new NetworkStack(app);
const mediaStack = new MediaLiveStack(app, networkStack.configuredTags);

mediaStack.addDependency(networkStack);

// cdk-nag checks
Aspects.of(app).add(new AwsSolutionsChecks());
