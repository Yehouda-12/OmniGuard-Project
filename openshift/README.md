# OpenShift Deployment

This folder contains OpenShift manifests for deploying the OmniGuard frontend and backend with Docker images.

## Option A: Build inside OpenShift

Apply the build manifests first:

```bash
oc apply -f openshift/backend-build.yaml
oc apply -f openshift/frontend-build.yaml
```

The build configs already point to the current GitHub repository and branch.

Start the builds:

```bash
oc start-build omniguard-backend --follow
oc start-build omniguard-frontend --follow
```

## Option B: Build locally with Docker

### 1. Build the backend image

```bash
docker build -f server/Dockerfile -t omniguard-backend:latest .
```

### 2. Build the frontend image

```bash
docker build -f client/Dockerfile -t omniguard-frontend:latest .
```

### 3. Push images

Tag and push both images to the OpenShift internal registry or any registry your cluster can pull from.

## 4. Create backend secret

Use `backend-secret.yaml` for real values, and keep `backend-secret.example.yaml` only as a safe template for Git.

## 5. Apply manifests

```bash
oc apply -f openshift/backend-build.yaml
oc apply -f openshift/frontend-build.yaml
oc apply -f openshift/backend-configmap.yaml
oc apply -f openshift/backend-secret.yaml
oc apply -f openshift/backend-deployment.yaml
oc apply -f openshift/backend-service.yaml
oc apply -f openshift/backend-route.yaml
oc apply -f openshift/frontend-deployment.yaml
oc apply -f openshift/frontend-service.yaml
oc apply -f openshift/frontend-route.yaml
```

## 6. Notes

- The frontend proxies `/api`, `/socket.io`, and `/stream` to the backend service, so it does not need a build-time backend URL.
- Deploy the frontend and backend into the same OpenShift project so the internal service name `omniguard-backend` resolves correctly.
