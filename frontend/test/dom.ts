import { GlobalRegistrator } from "@happy-dom/global-registrator";

// A DOM for the page tests (react-dom/client needs one); the phone check uses a real Chrome.
GlobalRegistrator.register({ url: "http://localhost/stats/next/" });
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
