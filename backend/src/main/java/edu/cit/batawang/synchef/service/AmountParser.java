package edu.cit.batawang.synchef.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parses authored ingredient amounts ("400g", "2 tbsp", "½ tsp", "1.5 kg", "1 1/2 cups") into a
 * numeric quantity and unit, and formats scaled quantities back into friendly text.
 * Descriptive amounts ("fresh herbs (thyme, rosemary)") are kept verbatim and never scaled.
 */
public final class AmountParser {

    private static final Pattern AMOUNT = Pattern.compile(
            "^\\s*(\\d+\\s+\\d+/\\d+|\\d+/\\d+|\\d+(?:[.,]\\d+)?|[½¼¾⅓⅔⅛])\\s*(.*)$");

    private AmountParser() {
    }

    public record ParsedAmount(BigDecimal quantity, String unit) {
    }

    public static ParsedAmount parse(String text) {
        if (text == null || text.isBlank()) {
            return new ParsedAmount(null, "");
        }
        Matcher m = AMOUNT.matcher(text.trim());
        if (!m.matches()) {
            return new ParsedAmount(null, "");
        }
        BigDecimal qty = toNumber(m.group(1).trim());
        String unit = m.group(2) == null ? "" : m.group(2).trim();
        if (qty == null || unit.length() > 50) {
            return new ParsedAmount(null, "");
        }
        return new ParsedAmount(qty, unit);
    }

    private static BigDecimal toNumber(String token) {
        switch (token) {
            case "½": return new BigDecimal("0.5");
            case "¼": return new BigDecimal("0.25");
            case "¾": return new BigDecimal("0.75");
            case "⅓": return new BigDecimal("0.33");
            case "⅔": return new BigDecimal("0.67");
            case "⅛": return new BigDecimal("0.125");
            default: break;
        }
        try {
            if (token.contains(" ")) {
                String[] parts = token.split("\\s+");
                return new BigDecimal(parts[0]).add(fraction(parts[1]));
            }
            if (token.contains("/")) {
                return fraction(token);
            }
            return new BigDecimal(token.replace(',', '.'));
        } catch (NumberFormatException | ArithmeticException e) {
            return null;
        }
    }

    private static BigDecimal fraction(String token) {
        String[] parts = token.split("/");
        return new BigDecimal(parts[0]).divide(new BigDecimal(parts[1]), 3, RoundingMode.HALF_UP);
    }

    /** "1.50" → "1.5", "2.00" → "2", 0.25 → "¼" for kitchen-friendly fractions. */
    public static String formatQuantity(BigDecimal value) {
        if (value == null) return "";
        BigDecimal normalized = value.setScale(2, RoundingMode.HALF_UP).stripTrailingZeros();
        BigDecimal whole = normalized.setScale(0, RoundingMode.DOWN);
        BigDecimal remainder = normalized.subtract(whole);
        String fractionSymbol = switch (remainder.toPlainString()) {
            case "0.25" -> "¼";
            case "0.5" -> "½";
            case "0.75" -> "¾";
            default -> null;
        };
        if (fractionSymbol != null) {
            return whole.signum() == 0 ? fractionSymbol : whole.toPlainString() + fractionSymbol;
        }
        return normalized.toPlainString();
    }

    public static String display(BigDecimal quantity, String unit, String originalText) {
        if (quantity == null) {
            return originalText == null ? "" : originalText;
        }
        String qty = formatQuantity(quantity);
        if (unit == null || unit.isBlank()) return qty;
        // Units written attached in the source ("400g") stay attached; words get a space.
        boolean attached = unit.matches("^(g|kg|ml|l|mg)$");
        return attached ? qty + unit : qty + " " + unit;
    }
}
