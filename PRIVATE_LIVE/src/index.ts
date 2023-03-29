import { App, Aspects } from "aws-cdk-lib";
import { createMediaLiveStack } from "./stacks/media-services";
import { createNetworkStack } from "./stacks/networking";
import { AwsSolutionsChecks } from "cdk-nag";

export const STACK_PREFIX_NAME = "MediaServicesRefArch";

const app = new App();
const networkStack = createNetworkStack(app);
const mediaStack = createMediaLiveStack(app, networkStack.tags);

mediaStack.addDependency(networkStack.stack);

// cdk-nag checks
Aspects.of(app).add(new AwsSolutionsChecks());
