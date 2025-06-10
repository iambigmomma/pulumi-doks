const pulumi = require("@pulumi/pulumi");
const digitalocean = require("@pulumi/digitalocean");
const k8s = require("@pulumi/kubernetes");
const docker = require("@pulumi/docker");
const { WebAppComponent } = require("./components/webapp");

// Read configuration
const config = new pulumi.Config();
const doConfig = new pulumi.Config("digitalocean");
const customValue = config.get("customValue") || "abc123";
const clusterName = "pulumi-doks";
const appName = "webapp";

// Create DigitalOcean Kubernetes cluster
const cluster = new digitalocean.KubernetesCluster(clusterName, {
    region: "sgp1", // Singapore region
    version: "1.32.2-do.3", // Use latest stable version
    nodePool: {
        name: "default",
        size: "s-2vcpu-2gb", // Basic specs
        nodeCount: 2,
    },
    tags: ["pulumi", "webapp", "demo"],
});

// Create Kubernetes Provider
const k8sProvider = new k8s.Provider("k8s-provider", {
    kubeconfig: cluster.kubeConfigs[0].rawConfig,
});

// Use existing Container Registry
const registryName = "neimuc"; // Use your existing registry

// Create Docker Registry Secret for Kubernetes
const registrySecret = new k8s.core.v1.Secret("registry-secret", {
    metadata: {
        name: "registry-secret",
        namespace: "default",
    },
    type: "kubernetes.io/dockerconfigjson",
    data: {
        ".dockerconfigjson": pulumi.all([registryName, doConfig.requireSecret("token")]).apply(([username, password]) => {
            const dockerConfig = {
                auths: {
                    "registry.digitalocean.com": {
                        username: username,
                        password: password,
                        auth: Buffer.from(`${username}:${password}`).toString('base64')
                    }
                }
            };
            return Buffer.from(JSON.stringify(dockerConfig)).toString('base64');
        }),
    },
}, { provider: k8sProvider });

// Create Docker image
const image = new docker.Image("webapp-image", {
    imageName: pulumi.interpolate`registry.digitalocean.com/${registryName}/webapp:latest`,
    build: {
        context: ".",
        dockerfile: "Dockerfile",
        platform: "linux/amd64",
    },
    registry: {
        server: "registry.digitalocean.com",
        username: registryName,
        password: doConfig.requireSecret("token"),
    },
});

// Deploy application after cluster is ready
const webapp = new WebAppComponent("webapp", {
    image: image.imageName,
    customValue: customValue,
    hostname: pulumi.interpolate`${clusterName}.isfusion.cloud`,
    replicas: 2,
    imagePullSecrets: [{ name: "registry-secret" }], // Add imagePullSecrets
}, { 
    provider: k8sProvider,
    dependsOn: [cluster, image, registrySecret],
});

// Create LoadBalancer Service for external access (simplified version)
const loadBalancer = new k8s.core.v1.Service("webapp-lb", {
    metadata: {
        name: "webapp-lb",
    },
    spec: {
        type: "LoadBalancer",
        ports: [{
            port: 80,
            targetPort: 3000,
            protocol: "TCP",
        }],
        selector: {
            app: appName,
        },
    },
}, { provider: k8sProvider });

// Export important information
exports.clusterName = cluster.name;
exports.clusterId = cluster.id;
exports.kubeconfig = cluster.kubeConfigs[0].rawConfig;
exports.registryEndpoint = pulumi.interpolate`registry.digitalocean.com/${registryName}`;
exports.imageUrl = image.imageName;
exports.customValue = customValue;
exports.webappUrl = webapp.url;
exports.loadBalancerIp = loadBalancer.status.loadBalancer.ingress[0].ip; 