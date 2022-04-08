import { getSelectedText } from "@raycast/api";
import {rejects} from "assert";

export const isNotEmpty = (string: string | null) => {
    return string != null && String(string).length > 0;
};

export const readtext = () =>
    getSelectedText()
        .then((text) => (isNotEmpty(text) ? text : ""))
        .catch(() => "");
