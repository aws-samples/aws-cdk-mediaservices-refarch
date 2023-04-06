import { App, Aspects } from "aws-cdk-lib";
import { createMediaLiveStack } from "./stacks/media-services";
import { createPlayoutStack } from "./stacks/playout";
import { createHarvestApiStack } from "./stacks/harvest-api";
import { getHarvestCompleteStack } from "./stacks/harvest-complete";
import { AwsSolutionsChecks } from "cdk-nag";

export const STACK_PREFIX_NAME = "MediaServicesRefArch";

const app = new App();
const playoutOutputs = createPlayoutStack(app);
const mediaSvcsOutputs = createMediaLiveStack(app);
const harvestApiOutputs = createHarvestApiStack(app, playoutOutputs);
getHarvestCompleteStack(app, mediaSvcsOutputs, harvestApiOutputs.harvestIamMpRoleArn);
Aspects.of(app).add(new AwsSolutionsChecks());
