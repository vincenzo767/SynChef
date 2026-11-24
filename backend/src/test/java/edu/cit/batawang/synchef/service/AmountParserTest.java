package edu.cit.batawang.synchef.service;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class AmountParserTest {

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "400g|400|g",
            "2 tbsp|2|tbsp",
            "1|1|''",
            "½ tsp|0.5|tsp",
            "¼ tsp|0.25|tsp",
            "1.5 kg|1.5|kg",
            "1 1/2 cups|1.500|cups",
            "4 cloves|4|cloves"
    })
    void parsesNumericAmounts(String text, String quantity, String unit) {
        AmountParser.ParsedAmount parsed = AmountParser.parse(text);
        assertThat(parsed.quantity()).isEqualByComparingTo(new BigDecimal(quantity));
        assertThat(parsed.unit()).isEqualTo(unit);
    }

    @Test
    void keepsDescriptiveAmountsUnparsed() {
        assertThat(AmountParser.parse("fresh herbs (thyme, rosemary)").quantity()).isNull();
        assertThat(AmountParser.parse("tomato sauce (ketchup)").quantity()).isNull();
        assertThat(AmountParser.parse(null).quantity()).isNull();
    }

    @Test
    void formatsKitchenFriendlyQuantities() {
        assertThat(AmountParser.display(new BigDecimal("600.00"), "g", null)).isEqualTo("600g");
        assertThat(AmountParser.display(new BigDecimal("1.50"), "tbsp", null)).isEqualTo("1½ tbsp");
        assertThat(AmountParser.display(new BigDecimal("0.25"), "tsp", null)).isEqualTo("¼ tsp");
        assertThat(AmountParser.display(new BigDecimal("3"), "", null)).isEqualTo("3");
        assertThat(AmountParser.display(null, "", "1 handful")).isEqualTo("1 handful");
    }
}
