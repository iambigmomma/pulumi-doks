const pulumi = require("@pulumi/pulumi");
const k8s = require("@pulumi/kubernetes");

class WebAppComponent extends pulumi.ComponentResource {
    constructor(name, args, opts) {
        super("custom:webapp:WebApp", name, {}, opts);

        const { image, customValue, replicas = 2, imagePullSecrets } = args;

        // Create ConfigMap to store environment variables
        this.configMap = new k8s.core.v1.ConfigMap(`${name}-config`, {
            metadata: {
                name: `${name}-config`,
            },
            data: {
                CUSTOM_VALUE: customValue,
                PORT: "3000",
            },
        }, { parent: this });

        // Create Deployment
        this.deployment = new k8s.apps.v1.Deployment(`${name}-deployment`, {
            metadata: {
                name: `${name}-deployment`,
                labels: {
                    app: name,
                },
            },
            spec: {
                replicas: replicas,
                selector: {
                    matchLabels: {
                        app: name,
                    },
                },
                template: {
                    metadata: {
                        labels: {
                            app: name,
                        },
                    },
                    spec: {
                        imagePullSecrets: imagePullSecrets || [],
                        containers: [{
                            name: "webapp",
                            image: image,
                            ports: [{
                                containerPort: 3000,
                            }],
                            envFrom: [{
                                configMapRef: {
                                    name: this.configMap.metadata.name,
                                },
                            }],
                            livenessProbe: {
                                httpGet: {
                                    path: "/health",
                                    port: 3000,
                                },
                                initialDelaySeconds: 30,
                                periodSeconds: 10,
                            },
                            readinessProbe: {
                                httpGet: {
                                    path: "/health",
                                    port: 3000,
                                },
                                initialDelaySeconds: 5,
                                periodSeconds: 5,
                            },
                            resources: {
                                requests: {
                                    memory: "128Mi",
                                    cpu: "100m",
                                },
                                limits: {
                                    memory: "256Mi",
                                    cpu: "200m",
                                },
                            },
                        }],
                    },
                },
            },
        }, { parent: this });

        // Create Service
        this.service = new k8s.core.v1.Service(`${name}-service`, {
            metadata: {
                name: `${name}-service`,
                labels: {
                    app: name,
                },
            },
            spec: {
                type: "ClusterIP",
                ports: [{
                    port: 80,
                    targetPort: 3000,
                    protocol: "TCP",
                }],
                selector: {
                    app: name,
                },
            },
        }, { parent: this });

        // Create Ingress
        this.ingress = new k8s.networking.v1.Ingress(`${name}-ingress`, {
            metadata: {
                name: `${name}-ingress`,
                annotations: {
                    "kubernetes.io/ingress.class": "nginx",
                    "cert-manager.io/cluster-issuer": "letsencrypt-prod",
                },
            },
            spec: {
                tls: [{
                    hosts: [args.hostname],
                    secretName: `${name}-tls`,
                }],
                rules: [{
                    host: args.hostname,
                    http: {
                        paths: [{
                            path: "/",
                            pathType: "Prefix",
                            backend: {
                                service: {
                                    name: this.service.metadata.name,
                                    port: {
                                        number: 80,
                                    },
                                },
                            },
                        }],
                    },
                }],
            },
        }, { parent: this });

        // Export important information
        this.serviceName = this.service.metadata.name;
        this.deploymentName = this.deployment.metadata.name;
        this.url = pulumi.interpolate`https://${args.hostname}`;

        this.registerOutputs({
            serviceName: this.serviceName,
            deploymentName: this.deploymentName,
            url: this.url,
        });
    }
}

module.exports = { WebAppComponent }; 