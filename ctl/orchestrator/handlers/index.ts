import { greetHandler } from "./greetHandler";
import { chatHandler } from "./chatHandler";
import { orderFoodHandler } from "./orderFoodHandler";
import { bookTaxiHandler } from "./bookTaxiHandler";
import { documentQuestionHandler } from "./documentQuestionHandler";
import { userAccountControlHandler } from "./userAccountControlHandler"
import { fallbackHandler } from "./fallbackHandler";
import { IntentHandler } from "../IntentHandler";

export const intentHandlers: IntentHandler[] = [
  greetHandler,
  chatHandler,
  orderFoodHandler,
  bookTaxiHandler,
  documentQuestionHandler,
  userAccountControlHandler,
  fallbackHandler, // keep this last
];
