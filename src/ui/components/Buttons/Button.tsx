'use client';

import buttonStyles from "./buttonStyles.module.scss";

export default function Button({
  type = "filled", isDisabled = false, onPress, content, width = "full" }:{ 
  type?: "filled" | "outlined", isDisabled?: boolean, onPress?: () => void, content: string, width?: "small" | "medium" | "full" }) {

  return (
    <button
      className={
        buttonStyles.button + " " +
        (width === "small" ? buttonStyles['button--small'] : width === "medium" ? buttonStyles['button--medium'] : buttonStyles['button--full']) + " " +
        (type === "filled" ? buttonStyles['button--filled'] : buttonStyles['button--outlined']) + " " +
        (isDisabled ? buttonStyles['button--disabled'] : "")
      }

      aria-disabled={isDisabled}
      disabled={isDisabled}
      onClick={onPress}
    >
      {content}
    </button>
  )
}