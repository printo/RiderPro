import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CaptchaProps {
  onVerify: (isValid: boolean) => void;
  className?: string;
}

export function Captcha({ onVerify, className }: CaptchaProps) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [userAnswer, setUserAnswer] = useState('');
  const [isValid, setIsValid] = useState(false);
  const [isError, setIsError] = useState(false);

  const generateQuestion = () => {
    const operations = ['+', '-', '*'];
    const operation = operations[Math.floor(Math.random() * operations.length)];
    let num1, num2, result, questionText;

    switch (operation) {
      case '+':
        num1 = Math.floor(Math.random() * 20) + 1;
        num2 = Math.floor(Math.random() * 20) + 1;
        result = num1 + num2;
        questionText = `${num1} + ${num2} = ?`;
        break;
      case '-':
        num1 = Math.floor(Math.random() * 20) + 10;
        num2 = Math.floor(Math.random() * 10) + 1;
        result = num1 - num2;
        questionText = `${num1} - ${num2} = ?`;
        break;
      case '*':
        num1 = Math.floor(Math.random() * 10) + 1;
        num2 = Math.floor(Math.random() * 10) + 1;
        result = num1 * num2;
        questionText = `${num1} × ${num2} = ?`;
        break;
      default:
        num1 = 5;
        num2 = 3;
        result = 8;
        questionText = '5 + 3 = ?';
    }

    setQuestion(questionText);
    setAnswer(result.toString());
    setUserAnswer('');
    setIsValid(false);
    setIsError(false);
  };

  useEffect(() => {
    generateQuestion();
  }, []);

  useEffect(() => {
    if (userAnswer.trim() === '') {
      setIsValid(false);
      setIsError(false);
      onVerify(false);
    } else if (userAnswer.trim() === answer) {
      setIsValid(true);
      setIsError(false);
      onVerify(true);
    } else {
      setIsValid(false);
      setIsError(true);
      onVerify(false);
    }
  }, [userAnswer, answer, onVerify]);

  const handleRefresh = () => {
    generateQuestion();
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <Label htmlFor="captcha" className="text-sm font-medium">
          Security Check
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          className="h-8 w-8 p-0"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-center">
            <span className="text-lg font-medium text-gray-700">{question}</span>
          </div>
        </div>
        <Input
          id="captcha"
          type="number"
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          placeholder="Answer"
          className={`w-20 ${isError ? 'border-red-500' : isValid ? 'border-green-500' : ''}`}
        />
      </div>

      {isError && (
        <p className="text-xs text-red-600">Incorrect answer. Please try again.</p>
      )}
      {isValid && (
        <p className="text-xs text-green-600">✓ Correct!</p>
      )}
    </div>
  );
}
