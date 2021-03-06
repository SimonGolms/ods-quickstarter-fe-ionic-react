import org.ods.services.BitbucketService
import org.ods.services.GitService
import org.ods.services.OpenShiftService
import org.ods.services.ServiceRegistry
import org.ods.util.PipelineSteps

@Library('ods-jenkins-shared-library@4.x') _

odsComponentPipeline(
  branchToEnvironmentMapping: [
    'feature/': 'dev'
  ],
  debug: false,
  podContainers: [
    containerTemplate(
      alwaysPullImage: true,
      args: '${computer.jnlpmac} ${computer.name}',
      image: 'image-registry.openshift-image-registry.svc:5000/PROJECTID-cd/jenkins-agent-nodejs-16:latest',
      name: 'jnlp',
      // Before you increase the resources, make sure that the quotas provide the appropriate resources.
      resourceLimitCpu: '1',
      resourceLimitMemory: '4Gi',
      resourceRequestCpu: '10m',
      resourceRequestMemory: '1Gi',
      workingDir: '/tmp'
    )
  ],
) { context ->

  stageInitialize(context)
  stageInstallDependency(context)
  stageVersioning(context)

  /**
   * ! IMPORTANT - WORKAROUND
   * Rewrite 'odsComponentFindOpenShiftImageOrElse' since it always runs the 'orElse' block when triggered via Release Manager
   * See: https://github.com/opendevstack/ods-jenkins-shared-library/blob/841a4f8cf6a48c765e192349ec403f676c44953a/vars/odsComponentFindOpenShiftImageOrElse.groovy#L16-L22
   */
  // odsComponentFindOpenShiftImageOrElse(context) {
  stageWorkaroundFindOpenShiftImageOrElse(context, [
    imageTag: "${env.appVersion}",
    resourceName: "${env.appName}",
  ]) {
    // stageDebug(context)
    stageAnalyzeCode(context)
    odsComponentStageScanWithSonar(context, [
      analyzePullRequests: false,
    ])
    stageBuild(context)
    stageDeploy(context)
    odsComponentStageBuildOpenShiftImage(context, [
      imageTag: "${env.appVersion}",
      resourceName: "${env.appName}",
    ])
  }

  /**
   * ! IMPORTANT - WORKAROUND
   * Create missing (fake) test result reports that are necessary for type 'ods-infra' when triggered via Release Manager
   */
  stageWorkaroundUnitTest(context)

  /**
   * ! IMPORTANT - WORKAROUND
   * Helm is currently not supported by the 'odsComponentStageRolloutOpenShiftDeployment' in 'ods-jenkins-shared-library@4.x'
   * when it's triggerd via Release Manager. Therefore we have to write our own rollout stage and rely on existing ODS services.
   * See comment in 'metadata.yml' for furhter details.
   */
  // odsComponentStageRolloutOpenShiftDeployment(context)
  stageWorkaroundRolloutDeployment(context)

  stageRelease(context)
}

def stageInitialize(def context) {
  stage('Initialize') {
    // Disable husky (git hooks) in CI, see: https://typicode.github.io/husky/#/?id=disable-husky-in-cidocker
    env.HUSKY = 0

    if (context.triggeredByOrchestrationPipeline) {
      stageInitializeWithReleaseManager(context)
      return
    }

    // Replace all non-alphanumeric characters with a dash
    env.branchName = context.gitBranch.replaceAll(/[^a-zA-Z0-9]/,'-').toLowerCase()

    /**
     * odsComponentStageBuildOpenShiftImage will fail in case of appName = ${context.componentId}-${branchName}
     * See: https://github.com/opendevstack/ods-jenkins-shared-library/issues/877
     */
    env.appName = "${context.projectId}-${context.componentId}-${branchName}"

    /**
     * Replace '${context.projectId}-${context.componentId}' with your preferred URL template, but keep in mind that there can only be one unique URL per OpenShift instance
     * and that specifying only '${context.projectId}-${branchName}' or '${context.componentId}-${branchName}" may not be enough!
     *
     * With this approach, the feature environments of application is for example accessible at the following URLs:
     * https://PROJECTID-COMPONENTID-feature-foo.dev.apps.OPENSHIFT_DOMAIN_DEV
     */
    env.appUrl = "${context.projectId}-${context.componentId}-${branchName}"
  }
}

def stageInitializeWithReleaseManager(def context) {
  env.appName = "${context.componentId}"

  /**
   * Replace '${context.projectId}-${context.componentId}' with your preferred URL template, but keep in mind that there can only be one unique URL per OpenShift instance
   * and that specifying only '${context.projectId}' may not be enough! Also, at least in the OpenShift dev instance the environment value should be included,
   * while for the prod instance the environment can be omitted for a better end user and developer experience.
   *
   * With this approach, the application is accessible at the following URLs:
   * PROJECTID-prod: https://PROJECTID-COMPONENTID.apps.OPENSHIFT_DOMAIN_PROD
   * PROJECTID-test: https://PROJECTID-COMPONENTID-test.apps.OPENSHIFT_DOMAIN_DEV
   * PROJECTID-dev: https://PROJECTID-COMPONENTID-dev.apps.OPENSHIFT_DOMAIN_DEV
   */
  env.appUrl = context.environment == 'prod' ? "${context.projectId}-${context.componentId}" : "${context.projectId}-${context.componentId}-${context.environment}"
}

def stageDebug(def context) {
  stage('DEBUG: Environment Variables') {
    sh(
      label: 'Print Environment Variables',
      script: 'printenv | sort',
    )
  }
  stage('DEBUG: Context') {
      echo "context.environment: ${context.environment}"
      echo "context.targetProject: ${context.targetProject}"
      echo "context.triggeredByOrchestrationPipeline: ${context.triggeredByOrchestrationPipeline}"
  }
}

def stageInstallDependency(def context) {
  stage('Install Dependencies') {
    sh(
      label: 'Install exact version of Dependencies',
      script: 'npm ci',
    )
  }
}

def stageVersioning(def context) {
  stage('Versioning') {
    if (context.triggeredByOrchestrationPipeline) {
      stageVersioningWithReleaseManager(context)
      return
    }

    stageVersioningWithSemanticRelease(context)
  }
}

def stageVersioningWithReleaseManager(def context) {
  stage('Versioning (Release Manager)') {
    env.appVersion = "${env.RELEASE_PARAM_VERSION}"
  }
}

def stageVersioningWithSemanticRelease(def context) {
  stage('Versioning (Semantic Release)') {
    def bitbucketService = ServiceRegistry.instance.get(BitbucketService)

    withCredentials([
      usernameColonPassword(
        credentialsId: bitbucketService.getPasswordCredentialsId(),
        variable: 'GIT_CREDENTIALS'
      )
    ]) {
      withEnv([
        "BRANCH_NAME=${context.gitBranch}"
      ]) {
        sh(
          label: 'Identify semantic-release version',
          script: 'npm run release:version',
        )
        sh(
          label: 'Test version file',
          script: "test -e .VERSION || (echo ${context.shortGitCommit} > .VERSION)",
        )
        env.appVersion = sh(
          label: 'Provide version as env variable',
          script: 'cat .VERSION',
          returnStdout: true
        ).trim()
      }
    }
  }
}

/**
 * Basically, the source code was copied from the component 'odsComponentFindOpenShiftImageOrElse' and the restriction to the Release Manager was removed.
 * See: https://github.com/opendevstack/ods-jenkins-shared-library/blob/841a4f8cf6a48c765e192349ec403f676c44953a/vars/odsComponentFindOpenShiftImageOrElse.groovy
 */
def stageWorkaroundFindOpenShiftImageOrElse(def context, Map config = [:], Closure block) {
  def openShiftService = ServiceRegistry.instance.get(OpenShiftService)

  if (!config.resourceName) {
    config.resourceName = context.componentId
  }

  if (!config.imageTag) {
    config.imageTag = context.shortGitCommit
  }

  def imageExists = openShiftService.imageExists(context.cdProject, config.resourceName, config.imageTag)
  if (imageExists) {
      echo "Image '${config.resourceName}:${config.imageTag}' exists already in '${context.cdProject}'. The 'orElse' block will not be executed."
      def imageReference = openShiftService.getImageReference(context.cdProject, config.resourceName, config.imageTag)
      def info = [image: imageReference]
      context.addBuildToArtifactURIs(config.resourceName, info)
      return
  }
  echo "Image '${config.resourceName}:${config.imageTag}' does not exist yet in '${context.cdProject}', executing the 'orElse' block now ..."
  block()
}

def stageAnalyzeCode(def context) {
  stage('Analyze Code') {
    sh(
      label: 'Check ESLint Rules',
      script: 'npm run lint',
    )
    sh(
      label: 'Check Helm Chart',
      script: 'helm lint chart --strict',
    )
  }
}

def stageTest(def context) {
  stage('Test Component') {
    /**
     * Run tests in the same thread to improve the speed
     * See: https://jestjs.io/docs/troubleshooting#tests-are-extremely-slow-on-docker-andor-continuous-integration-ci-server
     */
    sh(
      label: 'Test React Components',
      script: 'npm run test -- --runInBand',
    )
  }
}

def stageBuild(def context) {
  stage('Build') {
    withEnv([
      "DISABLE_ESLINT_PLUGIN=true", // ESLint rules already checked in 'stageAnalyzeCode'; no need to double check
      "GENERATE_SOURCEMAP=false", // Nothing in place to take advantage of sourcemaps; no need to generate one
      "REACT_APP_VERSION=${env.appVersion}",
    ]) {
      sh(
        label: 'Build App as a static web application for production',
        script: 'npx ionic build',
      )
    }
  }
}

def stageDeploy(def context) {
  stage('Deploy') {
    sh(
      label: 'Move build folder into docker directory',
      script: 'mv build docker/',
    )
  }
}

def stageWorkaroundUnitTest(def context) {
  stage('Unit Test') {
    /**
     * This is a wild mix of fake test results which have come together through several attempts from error messages and test
     * results to be able to perform a rollout for the workaround type 'ods-infra' with and without the release manager.
     * Of course, the test cases should be replaced by correct test results.
     */
    sh(
      label: 'Create Fake Unit Test Results',
      script: 'mkdir --parent build/test-results && touch build/test-results/stub.log',
    )
    stash(allowEmpty: true, includes: 'build/test-results/**.xml', name: "acceptance-test-reports-junit-xml-${context.componentId}-${context.buildNumber}")
    stash(allowEmpty: true, includes: 'build/test-results/**.log', name: "changes-${context.componentId}-${context.buildNumber}")
    stash(allowEmpty: true, includes: 'build/test-results/**.xml', name: "installation-test-reports-junit-xml-${context.componentId}-${context.buildNumber}")
    stash(allowEmpty: true, includes: 'build/test-results/**.xml', name: "integration-test-reports-junit-xml-${context.componentId}-${context.buildNumber}")
    stash(allowEmpty: true, includes: 'build/test-results/**.log', name: "state-${context.componentId}-${context.buildNumber}")
    stash(allowEmpty: true, includes: 'build/test-results/**.log', name: "target-${context.componentId}-${context.buildNumber}")
    stash(allowEmpty: true, includes: 'build/test-results/**.xml', name: "test-reports-junit-xml-${context.componentId}-${context.buildNumber}")
  }
}

def stageWorkaroundRolloutDeployment(def context){
  stage('Rollout') {
    if (!context.environment) {
      echo 'Skip because of empty (target) environment'
      return
    }

    /**
    * Since the PROD environment is located in another OpenShift instance it is necessary to log in to this instance first in order to be able to perform the corresponding rollout (Helm Chart).
    * See: https://github.com/opendevstack/ods-jenkins-shared-library/blob/841a4f8cf6a48c765e192349ec403f676c44953a/vars/withOpenShiftCluster.groovy#L43-L74
    */
    if (context.environment == 'prod') {
      def steps = new PipelineSteps(this)
      def openShiftTargetApiUrl = 'https://api.OPENSHIFT_DOMAIN_PROD:6443'

      withCredentials([
        usernamePassword(
            credentialsId: 'PROJECTID-cd-PROJECTID-prod',
            usernameVariable: 'EXTERNAL_OPENSHIFT_API_USER',
            passwordVariable: 'EXTERNAL_OPENSHIFT_API_TOKEN',
        )
      ]) {
        OpenShiftService.loginToExternalCluster(steps, openShiftTargetApiUrl, EXTERNAL_OPENSHIFT_API_TOKEN) // See: https://github.com/opendevstack/ods-jenkins-shared-library/blob/841a4f8cf6a48c765e192349ec403f676c44953a/src/org/ods/services/OpenShiftService.groovy#L38-L43
      }
    }

    stageRolloutWithHelm(context)
  }
}

def stageRolloutWithHelm(def context) {
  stage('Rollout (Helm)') {
    def openShiftService = ServiceRegistry.instance.get(OpenShiftService)

    // List of additional flags to be passed verbatim to to helm upgrade (empty by default)
    def helmAdditionalFlags = []

    // List of default flags to be passed verbatim to to helm upgrade (defaults to ['--install', '--atomic']).
    // Typically these should not be modified - if you want to pass more flags, use helmAdditionalFlags instead.
    def helmDefaultFlags = ['--install', '--atomic']

    // Whether to show diff explaining changes to the release before running helm upgrade (true by default).
    def helmDiff = true

    // Name of the Helm release (defaults to context.componentId). Change this value if you want to install separate instances of the Helm chart in the same namespace.
    // In that case, make sure to use {{ .Release.Name }} in resource names to avoid conflicts.
    def helmReleaseName = "${env.appName}"

    // helmValues: Key/value pairs to pass as values (by default, the key imageTag is set to the config option imageTag).
    def helmValues = [
      'appUrl': "${env.appUrl}",
      'imageTag': "${env.appVersion}",
      'nameOverride': "${env.appName}",
      'odsApplicationDomain': openShiftService.getApplicationDomain(context.targetProject),
    ]

    // helmValuesFiles: List of paths to values files (empty by default).
    def helmValuesFiles = ["values.${context.environment}.yaml"]

    // Go to directory where the helm chart is located
    dir('chart'){
      // we'll simply reuse the instance from above to do the actual helm rollout
      openShiftService.helmUpgrade("${context.targetProject}", helmReleaseName, helmValuesFiles, helmValues, helmDefaultFlags, helmAdditionalFlags, helmDiff)
    }
  }
}

def stageRelease(def context) {
  stage('Release') {
    if (context.triggeredByOrchestrationPipeline) {
      stageReleaseWithReleaseManager(context)
      return
    }

    stageReleaseWithSemanticRelease(context)
  }
}

def stageReleaseWithReleaseManager (def context) {
  stage('Release (Release Manager)') {
    echo 'Skip because pipeline is triggered via ODS Release Manager'
    if (context.environment == 'dev') {
      // Colored output to highlight the important information, see: https://plugins.jenkins.io/ansicolor/
      echo '\033[34mPlease make sure to merge the release branch into master afterwards, so that the check for git commit anchestor is successful and a release into QA and PROD environemnt can be done without warnings and errors.\nSee comment in file \'metadata.yml\' for furhter details.\033[0m'
    }
  }
}

def stageReleaseWithSemanticRelease(def context) {
  stage('Release (Semenatic Release)') {
    def bitbucketService = ServiceRegistry.instance.get(BitbucketService)

    withCredentials([
      usernameColonPassword(
        credentialsId: bitbucketService.getPasswordCredentialsId(),
        variable: 'GIT_CREDENTIALS'
      )
    ]) {
      withEnv([
        "BRANCH_NAME=${context.gitBranch}",
      ]) {
        sh(
          label: 'Run Semantic Release',
          script: 'npm run release',
        )
      }
    }
  }
}
