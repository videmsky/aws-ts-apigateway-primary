import * as pulumi from "@pulumi/pulumi";
import * as service from "@pulumi/pulumiservice";

const org = pulumi.getOrganization()
const project = pulumi.getProject()
const stack = pulumi.getStack()
const config = new pulumi.Config();
const name = config.get("name");

const deploymentSettings = new service.DeploymentSettings(`${name}-deployment-settings`, {
  organization: org,
  project: project,
  stack: stack,
  operationContext: {
    preRunCommands: ["curl -o- -L https://yarnpkg.com/install.sh | bash", "yarn install"],
		environmentVariables: {
			PULUMI_ACCESS_TOKEN: config.requireSecret("pulumiAccessToken"),
		},		
		options: {
			skipInstallDependencies: true,
		},
  },
  sourceContext: {
    git: {
      branch: "refs/heads/main",
      repoUrl: "https://github.com/videmsky/aws-ts-apigateway-primary.git",
    }
  }
});

// const driftSchedule = new service.DriftSchedule(`${name}-driftSchedule`, {
//   organization: org,
//   project: project,
//   stack: stack,
//   scheduleCron: "0 */4 * * *",
//   autoRemediate: true
// }, {dependsOn: [deploymentSettings]})

// const ttlSchedule = new service.TtlSchedule(`${name}-ttlSchedule`, {
//   organization: org,
//   project: project,
//   stack: stack,
//   timestamp: "2025-09-30T00:00:00Z"
// }, {dependsOn: [deploymentSettings]})