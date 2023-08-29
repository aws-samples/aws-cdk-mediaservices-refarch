import { App, Aspects } from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
import { MediaStack } from "../lib/stacks/media-services";
import { MonitoringStack } from "../lib/stacks/monitoring-stack";

const app = new App();
const mediaStack = new MediaStack(app);
new MonitoringStack(app, mediaStack.ml.ref, mediaStack.mp.ref);
Aspects.of(app).add(new AwsSolutionsChecks());
