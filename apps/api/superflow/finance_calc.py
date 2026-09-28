"""Deterministic investment formulas. No LLM arithmetic; every result is reproducible.

Cash flows are annual; index 0 is the initial (negative) investment at period start.
Money is rounded to whole IDR and rates to four decimals only at presentation.
"""

from dataclasses import dataclass

SENSITIVITY_STEPS = (-0.2, -0.1, 0.0, 0.1, 0.2)


def cash_flows(investment: float, annual_inflow: float, periods: int) -> list[float]:
    if investment <= 0 or periods <= 0:
        raise ValueError("Investment and periods must be positive.")
    return [-investment] + [annual_inflow] * periods


def npv(rate: float, flows: list[float]) -> float:
    return sum(flow / (1 + rate) ** period for period, flow in enumerate(flows))


def irr(flows: list[float], low: float = -0.99, high: float = 10.0) -> float | None:
    """Bisection on NPV = 0. None when there is no sign change (IRR undefined)."""
    f_low, f_high = npv(low, flows), npv(high, flows)
    if f_low * f_high > 0:
        return None
    for _ in range(200):
        mid = (low + high) / 2
        value = npv(mid, flows)
        if abs(value) < 1e-6:
            return mid
        if f_low * value < 0:
            high = mid
        else:
            low, f_low = mid, value
    return (low + high) / 2


def roi(flows: list[float]) -> float:
    investment = -flows[0]
    return (sum(flows[1:]) - investment) / investment


def payback(flows: list[float]) -> float | None:
    """Simple payback in years with linear interpolation inside the recovery year."""
    cumulative = flows[0]
    for period, flow in enumerate(flows[1:], start=1):
        if cumulative + flow >= 0:
            return period - 1 + (-cumulative / flow if flow else 0)
        cumulative += flow
    return None


def annuity_factor(rate: float, periods: int) -> float:
    return periods if rate == 0 else (1 - (1 + rate) ** -periods) / rate


def break_even_inflow(investment: float, rate: float, periods: int) -> float:
    """Level annual inflow at which NPV equals zero at the given discount rate."""
    return investment / annuity_factor(rate, periods)


@dataclass(frozen=True)
class Inputs:
    investment: float
    annual_inflow: float
    periods: int
    rate: float

    def with_change(self, variable: str, step: float) -> "Inputs":
        values = {
            "investment": self.investment,
            "annual_inflow": self.annual_inflow,
            "rate": self.rate,
        }
        values[variable] *= 1 + step
        return Inputs(values["investment"], values["annual_inflow"], self.periods, values["rate"])

    @property
    def flows(self) -> list[float]:
        return cash_flows(self.investment, self.annual_inflow, self.periods)


def metrics(inputs: Inputs) -> dict:
    flows = inputs.flows
    rate_irr = irr(flows)
    years = payback(flows)
    return {
        "npv": round(npv(inputs.rate, flows)),
        "irr": None if rate_irr is None else round(rate_irr, 4),
        "roi": round(roi(flows), 4),
        "payback_years": None if years is None else round(years, 2),
        "break_even_inflow": round(
            break_even_inflow(inputs.investment, inputs.rate, inputs.periods)
        ),
        "cash_flows": [round(flow) for flow in flows],
    }


def sensitivity(inputs: Inputs) -> list[dict]:
    """NPV when one input moves by the given relative step; others stay at base."""
    return [
        {
            "variable": variable,
            "npv": [
                round(npv(changed.rate, changed.flows))
                for changed in (inputs.with_change(variable, step) for step in SENSITIVITY_STEPS)
            ],
        }
        for variable in ("investment", "annual_inflow", "rate")
    ]
