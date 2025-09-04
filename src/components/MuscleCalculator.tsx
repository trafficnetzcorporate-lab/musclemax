import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, Target, TrendingUp } from 'lucide-react';
import fitnessHero from '@/assets/fitness-hero.jpg';

interface CalculationResults {
  currentLeanBodyMass: number;
  maxGeneticLeanBodyMass: number;
  potentialGain: number;
  bodyweightAtMax: number;
  influencerSuggestion: string;
}

interface FormData {
  bodyFat: string;
  targetBodyFat: string;
  wrist: string;
  ankle: string;
  weight: string;
  heightFt: string;
  heightIn: string;
  heightCm: string;
  heightUnit: string;
  trainingGoal: string;
}

const MuscleCalculator = () => {
  const [formData, setFormData] = useState<FormData>({
    bodyFat: '',
    targetBodyFat: '10',
    wrist: '',
    ankle: '',
    weight: '',
    heightFt: '',
    heightIn: '',
    heightCm: '',
    heightUnit: 'imperial',
    trainingGoal: 'lean'
  });

  const [results, setResults] = useState<CalculationResults | null>(null);

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Casey Butt's accurate formula
  const caseyButtMaxLBM = (heightIn: number, wristIn: number, ankleIn: number, targetBfPercent: number) => {
    const termBones = Math.sqrt(wristIn) / 22.6670 + Math.sqrt(ankleIn) / 17.0104;
    const bfFactor = targetBfPercent / 224 + 1;
    return Math.pow(heightIn, 1.5) * termBones * bfFactor;
  };

  const calculateResults = () => {
    const bodyFat = parseFloat(formData.bodyFat);
    const targetBodyFat = parseFloat(formData.targetBodyFat);
    const wrist = parseFloat(formData.wrist);
    const ankle = parseFloat(formData.ankle);
    const weight = parseFloat(formData.weight);
    
    let heightInches: number;
    if (formData.heightUnit === 'imperial') {
      heightInches = parseInt(formData.heightFt) * 12 + parseInt(formData.heightIn);
    } else {
      heightInches = parseFloat(formData.heightCm) / 2.54;
    }

    // Current lean body mass
    const currentLeanBodyMass = weight * (1 - bodyFat / 100);
    
    // Maximum lean body mass using correct Casey Butt formula
    const maxLeanBodyMass = caseyButtMaxLBM(heightInches, wrist, ankle, targetBodyFat);
    
    // Potential gain
    const potentialGain = Math.max(0, maxLeanBodyMass - currentLeanBodyMass);
    
    // Bodyweight at maximum potential
    const bodyweightAtMax = maxLeanBodyMass / (1 - targetBodyFat / 100);

    // Dynamic influencer suggestions based on remaining potential and training goal
    const pctToGo = potentialGain / Math.max(1, maxLeanBodyMass);
    let influencerSuggestion: string;
    
    if (formData.trainingGoal === 'lean') {
      if (pctToGo > 0.25) {
        influencerSuggestion = 'Jeff Nippard - Strength + lean physique focus';
      } else if (pctToGo > 0.15) {
        influencerSuggestion = 'Greg Doucette - Efficient training for lean gains';
      } else {
        influencerSuggestion = 'Alain Gonzalez - Lean, aesthetic emphasis';
      }
    } else {
      if (pctToGo > 0.30) {
        influencerSuggestion = 'Jeff Seid - High hypertrophy emphasis';
      } else if (pctToGo > 0.15) {
        influencerSuggestion = 'David Laid - Aesthetic mass with leanness';
      } else {
        influencerSuggestion = 'Steve Reeves (classic line) - Classic proportions at/near potential';
      }
    }

    setResults({
      currentLeanBodyMass: Math.round(currentLeanBodyMass * 10) / 10,
      maxGeneticLeanBodyMass: Math.round(maxLeanBodyMass * 10) / 10,
      potentialGain: Math.round(potentialGain * 10) / 10,
      bodyweightAtMax: Math.round(bodyweightAtMax * 10) / 10,
      influencerSuggestion
    });
  };

  const isFormValid = () => {
    if (formData.heightUnit === 'imperial') {
      return formData.bodyFat && formData.targetBodyFat && formData.wrist && formData.ankle && formData.weight && 
             formData.heightFt && formData.heightIn;
    } else {
      return formData.bodyFat && formData.targetBodyFat && formData.wrist && formData.ankle && formData.weight && 
             formData.heightCm;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div 
          className="h-64 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${fitnessHero})` }}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative h-full flex items-center justify-center text-center">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Maximum Muscular Genetic Potential
              </h1>
              <p className="text-xl text-white/90">
                Discover your natural muscle-building limits using Casey Butt's proven formula
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Input Form */}
          <Card className="bg-gradient-dark border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Calculator className="w-5 h-5 text-primary" />
                Body Measurements
              </CardTitle>
              <CardDescription>
                Enter your measurements to calculate your genetic potential
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bodyFat">Current Body Fat %</Label>
                  <Input
                    id="bodyFat"
                    type="number"
                    placeholder="15"
                    value={formData.bodyFat}
                    onChange={(e) => handleInputChange('bodyFat', e.target.value)}
                    className="bg-secondary border-border"
                  />
                </div>
                <div>
                  <Label htmlFor="targetBodyFat">Target Body Fat %</Label>
                  <Input
                    id="targetBodyFat"
                    type="number"
                    placeholder="10"
                    value={formData.targetBodyFat}
                    onChange={(e) => handleInputChange('targetBodyFat', e.target.value)}
                    className="bg-secondary border-border"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="weight">Weight (lbs)</Label>
                  <Input
                    id="weight"
                    type="number"
                    placeholder="180"
                    value={formData.weight}
                    onChange={(e) => handleInputChange('weight', e.target.value)}
                    className="bg-secondary border-border"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="wrist">Wrist (inches)</Label>
                  <Input
                    id="wrist"
                    type="number"
                    step="0.1"
                    placeholder="7.0"
                    value={formData.wrist}
                    onChange={(e) => handleInputChange('wrist', e.target.value)}
                    className="bg-secondary border-border"
                  />
                </div>
                <div>
                  <Label htmlFor="ankle">Ankle (inches)</Label>
                  <Input
                    id="ankle"
                    type="number"
                    step="0.1"
                    placeholder="9.0"
                    value={formData.ankle}
                    onChange={(e) => handleInputChange('ankle', e.target.value)}
                    className="bg-secondary border-border"
                  />
                </div>
              </div>

              <div>
                <Label>Height</Label>
                <div className="flex gap-2 mt-2">
                  <Select value={formData.heightUnit} onValueChange={(value) => handleInputChange('heightUnit', value)}>
                    <SelectTrigger className="w-32 bg-secondary border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="imperial">ft/in</SelectItem>
                      <SelectItem value="metric">cm</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {formData.heightUnit === 'imperial' ? (
                    <>
                      <Input
                        type="number"
                        placeholder="5"
                        value={formData.heightFt}
                        onChange={(e) => handleInputChange('heightFt', e.target.value)}
                        className="bg-secondary border-border"
                      />
                      <Input
                        type="number"
                        placeholder="10"
                        value={formData.heightIn}
                        onChange={(e) => handleInputChange('heightIn', e.target.value)}
                        className="bg-secondary border-border"
                      />
                    </>
                  ) : (
                    <Input
                      type="number"
                      placeholder="175"
                      value={formData.heightCm}
                      onChange={(e) => handleInputChange('heightCm', e.target.value)}
                      className="flex-1 bg-secondary border-border"
                    />
                  )}
                </div>
              </div>

              <div>
                <Label>Training Goal</Label>
                <Select value={formData.trainingGoal} onValueChange={(value) => handleInputChange('trainingGoal', value)}>
                  <SelectTrigger className="bg-secondary border-border mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lean">Strength & Lean Look</SelectItem>
                    <SelectItem value="mass">Hypertrophy & Mass</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={calculateResults}
                disabled={!isFormValid()}
                className="w-full bg-gradient-primary hover:shadow-glow transition-all duration-300 text-primary-foreground font-semibold"
              >
                Calculate Genetic Potential
              </Button>
            </CardContent>
          </Card>

          {/* Results */}
          <Card className="bg-gradient-dark border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Target className="w-5 h-5 text-primary" />
                Your Genetic Potential
              </CardTitle>
              <CardDescription>
                Results based on Casey Butt's muscle-building formula
              </CardDescription>
            </CardHeader>
            <CardContent>
              {results ? (
                <div className="space-y-6">
                  <div className="grid gap-4">
                    <div className="bg-secondary/50 p-4 rounded-lg border border-border">
                      <div className="text-sm text-muted-foreground mb-1">Current Lean Body Mass</div>
                      <div className="text-3xl font-bold text-foreground">
                        {results.currentLeanBodyMass} lbs
                      </div>
                    </div>

                    <div className="bg-secondary/50 p-4 rounded-lg border border-border">
                      <div className="text-sm text-muted-foreground mb-1">Maximum Genetic Potential</div>
                      <div className="text-3xl font-bold text-primary">
                        {results.maxGeneticLeanBodyMass} lbs
                      </div>
                    </div>

                    <div className="bg-gradient-primary/10 p-4 rounded-lg border border-primary/20">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="w-4 h-4 text-primary" />
                        <div className="text-sm text-primary">Remaining Muscle Gain Potential</div>
                      </div>
                      <div className="text-3xl font-bold text-primary">
                        +{results.potentialGain} lbs
                      </div>
                    </div>

                    <div className="bg-secondary/50 p-4 rounded-lg border border-border">
                      <div className="text-sm text-muted-foreground mb-1">
                        Bodyweight at Max (at {formData.targetBodyFat}% BF)
                      </div>
                      <div className="text-3xl font-bold text-foreground">
                        {results.bodyweightAtMax} lbs
                      </div>
                    </div>
                  </div>

                  <div className="bg-secondary/30 p-4 rounded-lg border border-border">
                    <div className="text-sm text-muted-foreground mb-2">Suggested Influencer</div>
                    <div className="text-lg font-semibold text-primary">
                      {results.influencerSuggestion}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Based on your {formData.trainingGoal === 'lean' ? 'strength & lean' : 'hypertrophy & mass'} goal
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground bg-muted/20 p-3 rounded border border-border">
                    <strong>Note:</strong> These calculations are estimates based on Casey Butt's research. 
                    Individual results may vary based on genetics, training, nutrition, and other factors.
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  <div className="text-center">
                    <Calculator className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Enter your measurements to see your genetic potential</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default MuscleCalculator;