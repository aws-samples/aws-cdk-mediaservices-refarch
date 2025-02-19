import { App, Aspects } from "aws-cdk-lib";
import { ConsumeEmxEntitlementStack } from "../lib/";
import { AwsSolutionsChecks } from 'cdk-nag';

const app = new App();

/**
 * Determines whether context variable exists to just deploy the role construct.
 * This is important for Part 1 of the deployment (refer to README.md for full instructions).
 *
 * @returns boolean
 */
function deploymentRoleStep(): boolean{
    const stage = app.node.tryGetContext("stage") as string;
    if(!stage || stage != "role") return false;
    return true;
}

const consumeEmxEntitlement = new ConsumeEmxEntitlementStack(app);
const consumerRole = consumeEmxEntitlement.createConsumeRole();

if(!deploymentRoleStep()){
    const consumerFlow = consumeEmxEntitlement.createEntitlementConsumer(consumerRole.role);
    consumeEmxEntitlement.createStream(consumerFlow.emx)
}

Aspects.of(app).add(new AwsSolutionsChecks());
