import { SSTConfig } from "sst";
import { API } from "./stacks/ApiStack";

export default {
  config(_input) {
    return {
      name: "stripe-webhook-service",
      region: "us-east-1",
      mode: "local"
    };
  },
  stacks(app) {
    app.stack(API);
  }
} satisfies SSTConfig;