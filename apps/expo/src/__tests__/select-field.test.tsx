/// <reference types="jest" />
// SelectField 仅依赖 @expo/vector-icons / react-native / theme tokens，无需原生存储 mock。

import { fireEvent, render, screen } from "@testing-library/react-native";
import { SelectField } from "../components/SelectField";

const OPTIONS = [
  { label: "减脂", value: "cut" },
  { label: "增肌", value: "gain" },
  { label: "维持", value: "maintain" },
];

describe("SelectField", () => {
  test("显示当前选中项的标签", async () => {
    await render(<SelectField value="gain" options={OPTIONS} onChange={jest.fn()} />);
    expect(screen.getByText("增肌")).toBeTruthy();
  });

  test("value 无匹配选项时显示未选择", async () => {
    await render(<SelectField value="missing" options={OPTIONS} onChange={jest.fn()} />);
    expect(screen.getByText("未选择")).toBeTruthy();
  });

  test("点按展开选项列表，选择后回调 onChange 并关闭", async () => {
    const onChange = jest.fn();
    await render(<SelectField value="cut" options={OPTIONS} onChange={onChange} />);

    await fireEvent.press(screen.getByText("减脂"));
    // 展开后全部选项可见（含当前选中项）。
    expect(screen.getByText("增肌")).toBeTruthy();
    expect(screen.getByText("维持")).toBeTruthy();

    await fireEvent.press(screen.getByText("维持"));
    expect(onChange).toHaveBeenCalledWith("maintain");
    // 选择后 Modal 关闭：其余选项不再可见。
    expect(screen.queryByText("增肌")).toBeNull();
  });

  test("enabled=false 时置灰且不可展开", async () => {
    await render(<SelectField value="cut" options={OPTIONS} onChange={jest.fn()} enabled={false} />);
    await fireEvent.press(screen.getByText("减脂"));
    expect(screen.queryByText("增肌")).toBeNull();
  });
});
