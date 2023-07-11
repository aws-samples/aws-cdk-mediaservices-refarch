import { App, Aspects } from "aws-cdk-lib";
import { createMediaLiveStack } from "./stacks/media-services";
import { AwsSolutionsChecks } from "cdk-nag";
import { getMonitoringStack } from "./stacks/monitoring-stack";

const app = new App();
const { emlId, empId } = createMediaLiveStack(app);
getMonitoringStack(app, emlId, empId);
Aspects.of(app).add(new AwsSolutionsChecks());
