import { App, Aspects } from "aws-cdk-lib";
import { EmxEntitlementGrantStack } from "../lib/";
import { AwsSolutionsChecks } from 'cdk-nag';

const app = new App();
new EmxEntitlementGrantStack(app);

Aspects.of(app).add(new AwsSolutionsChecks());
