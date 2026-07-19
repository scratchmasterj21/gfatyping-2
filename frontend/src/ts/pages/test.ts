import * as TestLogic from "../test/test-logic";
import * as Funbox from "../test/funbox/funbox";
import Page from "./page";
import * as Keymap from "../elements/keymap";
import { blurInputElement } from "../input/input-element";
import { qsr } from "../utils/dom";
import { resetIncompleteTests } from "../states/test";

export const page = new Page({
  id: "test",
  element: qsr(".page.pageTest"),
  path: "/",
  beforeHide: async (): Promise<void> => {
    blurInputElement();
  },
  afterHide: async (): Promise<void> => {
    TestLogic.restart({
      noAnim: true,
    });
    void Funbox.clear();
  },
  beforeShow: async (): Promise<void> => {
    resetIncompleteTests();
    TestLogic.restart({
      noAnim: true,
    });
    void Keymap.refresh();
  },
});
