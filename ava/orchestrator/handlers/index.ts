import { greetHandler } from "./greetHandler";
import { smallTalkHandler } from "./smallTalkHandler";
import { orderFoodHandler } from "./orderFoodHandler";
import { bookTaxiHandler } from "./bookTaxiHandler";
import { documentQuestionHandler } from "./documentQuestionHandler";
import { fallbackHandler } from "./fallbackHandler";
import { IntentHandler } from "../IntentHandler";

export const intentHandlers: IntentHandler[] = [
  greetHandler,
  smallTalkHandler,
  orderFoodHandler,
  bookTaxiHandler,
  documentQuestionHandler,
  fallbackHandler, // keep this last
];
